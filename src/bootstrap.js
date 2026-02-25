import { detectPageContext } from './context-adapter.js';

export function initializeForPage({
  locationHref,
  documentRef,
  runReviewFeatures = () => {},
}) {
  const context = detectPageContext({ locationHref, documentRef });

  if (!context.isSupported) {
    return {
      initialized: false,
      reason: 'unsupported-context',
      context,
    };
  }

  runReviewFeatures(context);

  return {
    initialized: true,
    context,
  };
}
