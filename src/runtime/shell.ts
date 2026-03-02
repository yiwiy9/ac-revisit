import type { LocalDateKey } from "../shared/types.ts";
import type { Result } from "../shared/types.ts";

const LEGACY_MENU_SELECTOR = "ul.dropdown-menu";
const LEGACY_USER_HANDLE_SELECTOR = ".navbar-right .dropdown > .dropdown-toggle";
const TOP_PAGE_MYPAGE_SELECTOR = ".header-mypage";
const TOP_PAGE_MENU_SELECTOR = ".header-mypage_detail .header-mypage_list";

export const MENU_ENTRY_ID = "ac-revisit-menu-entry";
export const MENU_ENTRY_LINK_ID = "ac-revisit-menu-entry-link";

export interface AtCoderPageAdapter {
  detectPage(): AtCoderPage;
  inspectHeaderShell(): HeaderShellSnapshot;
}

export type AtCoderPage =
  | { readonly kind: "problem"; readonly path: string }
  | { readonly kind: "submission_detail"; readonly path: string }
  | { readonly kind: "other"; readonly path: string };

export type DomAnchorResult =
  | { readonly kind: "found"; readonly element: HTMLElement }
  | { readonly kind: "missing" };

export interface HeaderShellSnapshot {
  readonly hasLegacyUserMenu: boolean;
  readonly hasTopPageUserMenu: boolean;
  readonly menuAnchor: DomAnchorResult;
  readonly menuUserHandle: string | null;
}

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
      const legacyMenuAnchor = findElement(documentRef, LEGACY_MENU_SELECTOR);
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
              : { kind: "found", element: topPageMenuAnchor }
            : { kind: "found", element: legacyMenuAnchor },
        menuUserHandle:
          readTrimmedText(documentRef, LEGACY_USER_HANDLE_SELECTOR) ??
          readTrimmedText(documentRef, TOP_PAGE_MYPAGE_SELECTOR),
      };
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
      link.textContent = "ac-revisit 操作";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        dependencies.openPopup({
          source: "menu",
          today: dependencies.getToday(),
        });
      });

      item.append(link);
      headerShell.menuAnchor.element.append(item);

      return {
        ok: true,
        value: { mounted: true },
      };
    },
  };
}

function findElement(root: ParentNode, selector: string): HTMLElement | null {
  const element = root.querySelector(selector);

  return element instanceof HTMLElement ? element : null;
}

function readTrimmedText(root: ParentNode, selector: string): string | null {
  const element = root.querySelector(selector);

  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const text = element.textContent?.trim();

  return text && text.length > 0 ? text : null;
}
