const USER_MENU_SELECTOR = 'a[href^="/users/"]';
const TASK_LINK_SELECTOR = 'a[href*="/tasks/"]';

function toUrl(locationHref) {
  try {
    return new URL(locationHref);
  } catch {
    return null;
  }
}

function detectPageType(pathname) {
  if (/^\/contests\/[^/]+\/tasks\/[^/]+$/.test(pathname)) {
    return 'problem';
  }

  if (/^\/contests\/[^/]+\/submissions\/\d+$/.test(pathname)) {
    return 'submission-detail';
  }

  return 'other';
}

function extractProblemIdFromTaskLink(documentRef) {
  const href = documentRef?.querySelector?.(TASK_LINK_SELECTOR)?.getAttribute?.('href');
  if (!href) {
    return null;
  }

  const matched = href.match(/\/contests\/[^/]+\/tasks\/([^/]+)/);
  return matched ? matched[1] : null;
}

export function detectPageContext({ locationHref, documentRef }) {
  const parsedUrl = toUrl(locationHref);
  const hostname = parsedUrl?.hostname ?? '';
  const pathname = parsedUrl?.pathname ?? '';
  const isAtcoder = hostname === 'atcoder.jp' || hostname.endsWith('.atcoder.jp');
  const isLoggedIn = isAtcoder && Boolean(documentRef?.querySelector?.(USER_MENU_SELECTOR));
  const pageType = detectPageType(pathname);
  const problemId = pageType === 'submission-detail' ? extractProblemIdFromTaskLink(documentRef) : null;

  return {
    isAtcoder,
    isLoggedIn,
    isSupported: isAtcoder && isLoggedIn,
    pageType,
    problemId,
  };
}
