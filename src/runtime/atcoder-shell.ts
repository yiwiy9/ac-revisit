import type { ContestId, LocalDateKey, ProblemId, ProblemTitle } from "../shared/types.ts";
import type { Result } from "../shared/types.ts";

const LEGACY_USER_HANDLE_SELECTOR = ".navbar-right .dropdown > .dropdown-toggle";
const TOP_PAGE_MYPAGE_SELECTOR = ".header-mypage";
const TOP_PAGE_MENU_SELECTOR = ".header-mypage_detail .header-mypage_list";
const PROBLEM_HEADING_SELECTOR = ".col-sm-12 > span.h2";
const PROBLEM_COMMENTARY_LINK_SELECTOR = `${PROBLEM_HEADING_SELECTOR} > a.btn`;
export const MENU_ENTRY_ID = "ac-revisit-menu-entry";
export const MENU_ENTRY_LINK_ID = "ac-revisit-menu-entry-link";
export const TOGGLE_BUTTON_ID = "ac-revisit-toggle-button";
export const TOGGLE_BUTTON_CLASS = "ac-revisit-toggle-button";

export interface AtCoderPageAdapter {
  detectPage(): AtCoderPage;
  inspectHeaderShell(): HeaderShellSnapshot;
  findToggleAnchor(): DomAnchorResult;
  readProblemContextSource(): ProblemContextDomSource;
}

export type AtCoderPage =
  | { readonly kind: "problem"; readonly path: string }
  | { readonly kind: "submission_detail"; readonly path: string }
  | { readonly kind: "other"; readonly path: string };

export type DomAnchorResult =
  | {
      readonly kind: "found";
      readonly element: HTMLElement;
      readonly insertMode: "append" | "afterend";
    }
  | { readonly kind: "missing" };

export interface HeaderShellSnapshot {
  readonly hasLegacyUserMenu: boolean;
  readonly hasTopPageUserMenu: boolean;
  readonly menuAnchor: DomAnchorResult;
  readonly menuUserHandle: string | null;
}

export type ProblemContextDomSource =
  | {
      readonly kind: "problem";
      readonly pathname: string;
      readonly problemTitleText: string | null;
    }
  | {
      readonly kind: "submission_detail";
      readonly taskHref: string | null;
      readonly taskTitleText: string | null;
    }
  | { readonly kind: "other" };

export interface ProblemContextResolver {
  resolveCurrentProblem(): ProblemContextResult;
}

export type ProblemContextResult =
  | {
      readonly kind: "resolved";
      readonly problemId: ProblemId;
      readonly contestId: ContestId;
      readonly problemTitle: ProblemTitle;
    }
  | { readonly kind: "not_applicable" }
  | { readonly kind: "unresolvable" };

export interface AuthSessionGuard {
  resolveSession(): SessionResolution;
}

export type SessionResolution =
  | { readonly kind: "authenticated"; readonly userHandle: string | null }
  | { readonly kind: "anonymous" };

export interface MenuEntryAdapter {
  ensureEntryMounted(): Result<MenuEntryMountResult, MenuEntryMountError>;
}

export interface MenuEntryMountResult {
  readonly mounted: boolean;
}

export type MenuEntryMountError = { readonly kind: "anchor_missing" };

export interface ToggleMountCoordinator {
  mount(): Result<ToggleMountResult, ToggleMountError>;
}

export interface ToggleMountResult {
  readonly mounted: boolean;
  readonly isRegistered: boolean;
}

export type ToggleMountError =
  | { readonly kind: "anchor_missing" }
  | { readonly kind: "problem_unresolvable" };

export interface ToggleInteractionInput {
  readonly problemId: ProblemId;
  readonly problemTitle: ProblemTitle;
  readonly today: LocalDateKey;
  readonly isRegistered: boolean;
}

export interface ToggleMountCoordinatorDependencies {
  readonly pageAdapter: AtCoderPageAdapter;
  readonly getToday?: () => LocalDateKey;
  readonly resolveIsRegistered?: (problemId: ProblemId) => boolean;
  readonly onToggle?: (input: ToggleInteractionInput) => boolean;
  readonly documentRef?: Document;
}

export interface PopupOpenInput {
  readonly source: "menu";
  readonly today: LocalDateKey;
}

export interface MenuEntryAdapterDependencies {
  readonly pageAdapter: AtCoderPageAdapter;
  readonly getToday: () => LocalDateKey;
  readonly openPopup: (input: PopupOpenInput) => void;
  readonly documentRef?: Document;
}

export function createAtCoderPageAdapter(
  windowRef: Window = window,
  documentRef: Document = document,
): AtCoderPageAdapter {
  return {
    detectPage() {
      const path = windowRef.location.pathname;

      if (/^\/contests\/[^/]+\/tasks\/[^/]+$/.test(path)) {
        return { kind: "problem", path };
      }

      if (/^\/contests\/[^/]+\/submissions\/\d+$/.test(path)) {
        return { kind: "submission_detail", path };
      }

      return { kind: "other", path };
    },
    inspectHeaderShell() {
      const legacyMenuAnchor = findLegacyUserMenuAnchor(documentRef);
      const topPageMenuAnchor = findElement(documentRef, TOP_PAGE_MENU_SELECTOR);
      const hasLegacyUserMenu = legacyMenuAnchor !== null;
      const hasTopPageUserMenu =
        findElement(documentRef, TOP_PAGE_MYPAGE_SELECTOR) !== null && topPageMenuAnchor !== null;

      return {
        hasLegacyUserMenu,
        hasTopPageUserMenu,
        menuAnchor:
          legacyMenuAnchor === null
            ? topPageMenuAnchor === null
              ? { kind: "missing" }
              : { kind: "found", element: topPageMenuAnchor, insertMode: "append" }
            : { kind: "found", element: legacyMenuAnchor, insertMode: "append" },
        menuUserHandle:
          readTrimmedText(documentRef, LEGACY_USER_HANDLE_SELECTOR) ??
          readTrimmedText(documentRef, TOP_PAGE_MYPAGE_SELECTOR),
      };
    },
    findToggleAnchor() {
      const page = this.detectPage();

      if (page.kind === "problem") {
        const commentaryLink = findElement(documentRef, PROBLEM_COMMENTARY_LINK_SELECTOR);

        if (commentaryLink !== null) {
          return {
            kind: "found",
            element: commentaryLink,
            insertMode: "afterend",
          };
        }

        const heading = findElement(documentRef, PROBLEM_HEADING_SELECTOR);

        return heading === null
          ? { kind: "missing" }
          : { kind: "found", element: heading, insertMode: "append" };
      }

      if (page.kind !== "submission_detail") {
        return { kind: "missing" };
      }

      const taskLink = findSubmissionProblemTaskLink(documentRef);

      return taskLink === null
        ? { kind: "missing" }
        : { kind: "found", element: taskLink, insertMode: "afterend" };
    },
    readProblemContextSource() {
      const page = this.detectPage();

      if (page.kind === "problem") {
        return {
          kind: "problem",
          pathname: page.path,
          problemTitleText: readOwnTextContent(documentRef, PROBLEM_HEADING_SELECTOR),
        };
      }

      if (page.kind === "submission_detail") {
        const taskLink = findSubmissionProblemTaskLink(documentRef);

        return {
          kind: "submission_detail",
          taskHref: taskLink?.getAttribute("href") ?? null,
          taskTitleText: readElementText(taskLink),
        };
      }

      return { kind: "other" };
    },
  };
}

export function createAuthSessionGuard(pageAdapter: AtCoderPageAdapter): AuthSessionGuard {
  return {
    resolveSession() {
      const headerShell = pageAdapter.inspectHeaderShell();

      if (headerShell.hasLegacyUserMenu || headerShell.hasTopPageUserMenu) {
        return {
          kind: "authenticated",
          userHandle: headerShell.menuUserHandle,
        };
      }

      return { kind: "anonymous" };
    },
  };
}

export function createMenuEntryAdapter(
  dependencies: MenuEntryAdapterDependencies,
): MenuEntryAdapter {
  const documentRef = dependencies.documentRef ?? document;

  return {
    ensureEntryMounted() {
      if (documentRef.getElementById(MENU_ENTRY_ID) !== null) {
        return {
          ok: true,
          value: { mounted: false },
        };
      }

      const headerShell = dependencies.pageAdapter.inspectHeaderShell();

      if (headerShell.menuAnchor.kind === "missing") {
        return {
          ok: false,
          error: { kind: "anchor_missing" },
        };
      }

      const item = documentRef.createElement("li");
      item.id = MENU_ENTRY_ID;

      const link = documentRef.createElement("a");
      link.id = MENU_ENTRY_LINK_ID;
      link.href = "#";
      appendMenuLinkContents(link, documentRef, headerShell.menuAnchor.element);
      link.addEventListener("click", (event) => {
        event.preventDefault();
        dependencies.openPopup({
          source: "menu",
          today: dependencies.getToday(),
        });
      });

      item.append(link);
      insertMenuItem(headerShell.menuAnchor.element, item);

      return {
        ok: true,
        value: { mounted: true },
      };
    },
  };
}

export function createProblemContextResolver(
  pageAdapter: AtCoderPageAdapter,
): ProblemContextResolver {
  return {
    resolveCurrentProblem() {
      const source = pageAdapter.readProblemContextSource();

      if (source.kind === "other") {
        return { kind: "not_applicable" };
      }

      if (source.kind === "problem") {
        if (source.problemTitleText === null) {
          return { kind: "unresolvable" };
        }

        const parsed = parseProblemPath(source.pathname);

        return parsed === null
          ? { kind: "unresolvable" }
          : {
              kind: "resolved",
              contestId: parsed.contestId,
              problemId: parsed.problemId,
              problemTitle: source.problemTitleText,
            };
      }

      if (source.taskHref === null || source.taskTitleText === null) {
        return { kind: "unresolvable" };
      }

      const parsed = parseProblemPath(source.taskHref);

      return parsed === null
        ? { kind: "unresolvable" }
        : {
            kind: "resolved",
            contestId: parsed.contestId,
            problemId: parsed.problemId,
            problemTitle: source.taskTitleText,
          };
    },
  };
}

export function createToggleMountCoordinator(
  dependencies: ToggleMountCoordinatorDependencies,
): ToggleMountCoordinator {
  const documentRef = dependencies.documentRef ?? document;
  const problemContextResolver = createProblemContextResolver(dependencies.pageAdapter);

  return {
    mount() {
      const existingButton = documentRef.getElementById(TOGGLE_BUTTON_ID);
      const anchor = dependencies.pageAdapter.findToggleAnchor();

      if (anchor.kind === "missing") {
        return {
          ok: false,
          error: { kind: "anchor_missing" },
        };
      }

      const problem = problemContextResolver.resolveCurrentProblem();

      if (problem.kind !== "resolved") {
        return {
          ok: false,
          error: { kind: "problem_unresolvable" },
        };
      }

      const isRegistered = dependencies.resolveIsRegistered?.(problem.problemId) ?? false;

      if (existingButton instanceof HTMLButtonElement) {
        syncToggleButton(existingButton, isRegistered, problem.problemId);

        return {
          ok: true,
          value: {
            mounted: false,
            isRegistered,
          },
        };
      }

      const button = documentRef.createElement("button");
      button.type = "button";
      button.id = TOGGLE_BUTTON_ID;
      syncToggleButton(button, isRegistered, problem.problemId);
      const getToday = dependencies.getToday;
      const onToggle = dependencies.onToggle;
      if (onToggle !== undefined && getToday !== undefined) {
        button.addEventListener("click", () => {
          const currentRegistration = button.dataset.state === "registered";
          const nextRegistration = onToggle({
            problemId: problem.problemId,
            problemTitle: problem.problemTitle,
            today: getToday(),
            isRegistered: currentRegistration,
          });

          if (typeof nextRegistration === "boolean") {
            syncToggleButton(button, nextRegistration, problem.problemId);
          }
        });
      }
      insertRelative(anchor, button);

      return {
        ok: true,
        value: {
          mounted: true,
          isRegistered,
        },
      };
    },
  };
}

function findElement(root: ParentNode, selector: string): HTMLElement | null {
  const element = root.querySelector(selector);

  return element instanceof HTMLElement ? element : null;
}

function findLegacyUserMenuAnchor(documentRef: Document): HTMLElement | null {
  const candidates = Array.from(documentRef.querySelectorAll("ul.dropdown-menu")).filter(
    (candidate): candidate is HTMLElement => candidate instanceof HTMLElement,
  );

  for (const candidate of candidates) {
    const hasLogoutEntry = findMenuItem(candidate, (href, label) => {
      return (
        href.startsWith("/logout") || href.includes("form_logout") || label.includes("ログアウト")
      );
    });
    const hasSettingsEntry = findMenuItem(candidate, (href, label) => {
      return href.startsWith("/settings") || label.includes("設定");
    });

    if (hasLogoutEntry !== undefined || hasSettingsEntry !== undefined) {
      return candidate;
    }
  }

  return candidates.at(0) ?? null;
}

function findSubmissionProblemTaskLink(root: ParentNode): HTMLAnchorElement | null {
  const rows = Array.from(root.querySelectorAll(".col-sm-12 table tr"));

  for (const row of rows) {
    if (!(row instanceof HTMLTableRowElement)) {
      continue;
    }

    const headingCell = row.querySelector("th");

    if (readElementText(headingCell) !== "問題") {
      continue;
    }

    const taskLink = row.querySelector('a[href*="/tasks/"]');

    if (taskLink instanceof HTMLAnchorElement) {
      return taskLink;
    }
  }

  return null;
}

function readTrimmedText(root: ParentNode, selector: string): string | null {
  const element = root.querySelector(selector);

  return readElementText(element);
}

function readElementText(element: Element | null): string | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const text = element.textContent?.trim();

  return text && text.length > 0 ? text : null;
}

function readOwnTextContent(root: ParentNode, selector: string): string | null {
  const element = root.querySelector(selector);

  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const text = Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text && text.length > 0 ? text : null;
}

function parseProblemPath(
  path: string,
): { readonly contestId: ContestId; readonly problemId: ProblemId } | null {
  const match = /^\/contests\/([A-Za-z0-9_-]+)\/tasks\/([A-Za-z0-9_-]+)$/.exec(path);

  if (match === null) {
    return null;
  }

  const [, contestId, taskId] = match;

  return {
    contestId,
    problemId: `${contestId}/${taskId}`,
  };
}

function syncToggleButton(
  button: HTMLButtonElement,
  isRegistered: boolean,
  problemId: ProblemId,
): void {
  button.className = [
    "btn",
    isRegistered ? "btn-warning" : "btn-default",
    "btn-sm",
    TOGGLE_BUTTON_CLASS,
  ].join(" ");
  button.style.marginLeft = "0.5rem";
  button.style.verticalAlign = "middle";
  button.dataset.state = isRegistered ? "registered" : "unregistered";
  button.dataset.problemId = problemId;
  button.textContent = isRegistered ? "ac-revisit 解除" : "ac-revisit 追加";
}

function appendMenuLinkContents(
  link: HTMLAnchorElement,
  documentRef: Document,
  menuElement: HTMLElement,
): void {
  const icon = createMenuIcon(documentRef, menuElement);
  icon.dataset.icon = "true";
  icon.setAttribute("aria-hidden", "true");

  const spacer = documentRef.createTextNode(" ");

  const label = documentRef.createElement("span");
  label.textContent = "ac-revisit 操作";
  label.dataset.label = "true";

  link.append(icon, spacer, label);
}

function insertMenuItem(menuElement: HTMLElement, item: HTMLLIElement): void {
  const logoutItem = findMenuItem(menuElement, (href, label) => {
    return (
      href.startsWith("/logout") || href.includes("form_logout") || label.includes("ログアウト")
    );
  });

  if (logoutItem instanceof HTMLElement) {
    const trailingDivider =
      logoutItem.previousElementSibling instanceof HTMLLIElement &&
      logoutItem.previousElementSibling.classList.contains("divider")
        ? logoutItem.previousElementSibling
        : null;
    const insertionAnchor = trailingDivider ?? logoutItem;

    applyMenuItemStyling(item, insertionAnchor);
    insertionAnchor.insertAdjacentElement("beforebegin", item);
    return;
  }

  const settingsItem = findMenuItem(menuElement, (href, label) => {
    return href.startsWith("/settings") || label.includes("設定");
  });

  if (settingsItem instanceof HTMLElement) {
    applyMenuItemStyling(item, settingsItem);
    settingsItem.insertAdjacentElement("beforebegin", item);
    return;
  }

  const referenceItem = menuElement.querySelector("li");

  if (referenceItem instanceof HTMLElement) {
    applyMenuItemStyling(item, referenceItem);
  }

  menuElement.append(item);
}

function createMenuIcon(documentRef: Document, menuElement: HTMLElement): HTMLElement {
  const settingsIcon = findSettingsIcon(menuElement) ?? findSettingsIcon(documentRef);

  if (settingsIcon !== null) {
    return settingsIcon;
  }

  const fallbackIcon = documentRef.createElement("span");
  fallbackIcon.className = "glyphicon glyphicon-cog";

  return fallbackIcon;
}

function findSettingsIcon(root: ParentNode): HTMLElement | null {
  const settingsLink = findMenuItem(
    root,
    (href, label) => href.startsWith("/settings") || label.includes("設定"),
  )?.querySelector("span.glyphicon, span.fa, i.glyphicon, i.fa, i.a-icon, span.a-icon");

  if (!(settingsLink instanceof HTMLElement)) {
    return null;
  }

  return settingsLink.cloneNode(true) as HTMLElement;
}

function applyMenuItemStyling(item: HTMLLIElement, referenceItem: HTMLElement): void {
  const referenceLink = referenceItem.querySelector("a");
  const link = item.querySelector("a");

  if (
    referenceLink instanceof HTMLAnchorElement &&
    link instanceof HTMLAnchorElement &&
    !referenceItem.classList.contains("divider")
  ) {
    link.className = referenceLink.className;
  }
}

function findMenuItem(
  root: ParentNode,
  predicate: (href: string, label: string) => boolean,
): HTMLElement | undefined {
  return Array.from(root.querySelectorAll("li")).find((candidate) => {
    const link = candidate.querySelector("a");
    const href = link?.getAttribute("href") ?? "";
    const label = link?.textContent?.trim() ?? "";

    return predicate(href, label);
  });
}

function insertRelative(
  anchor: Extract<DomAnchorResult, { kind: "found" }>,
  element: HTMLElement,
): void {
  if (anchor.insertMode === "afterend") {
    anchor.element.insertAdjacentElement("afterend", element);
    return;
  }

  anchor.element.append(element);
}
