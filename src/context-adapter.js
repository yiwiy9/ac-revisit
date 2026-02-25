const USER_MENU_SELECTOR = 'a[href^="/users/"]';

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

export function detectPageContext({ locationHref, documentRef }) {
  const parsedUrl = toUrl(locationHref);
  const hostname = parsedUrl?.hostname ?? '';
  const pathname = parsedUrl?.pathname ?? '';
  const isAtcoder = hostname === 'atcoder.jp' || hostname.endsWith('.atcoder.jp');
  const isLoggedIn = isAtcoder && Boolean(documentRef?.querySelector?.(USER_MENU_SELECTOR));
  const pageType = detectPageType(pathname);

  return {
    isAtcoder,
    isLoggedIn,
    isSupported: isAtcoder && isLoggedIn,
    pageType,
  };
}
