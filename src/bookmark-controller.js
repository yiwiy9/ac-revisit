function extractProblemIdFromHref(locationHref) {
  try {
    const url = new URL(locationHref);
    const matched = url.pathname.match(/^\/contests\/[^/]+\/tasks\/([^/]+)$/);
    return matched ? matched[1] : null;
  } catch {
    return null;
  }
}

function resolveProblemId({ pageContext, locationHref }) {
  if (pageContext.pageType === 'problem') {
    return extractProblemIdFromHref(locationHref);
  }

  if (pageContext.pageType === 'submission-detail') {
    return pageContext.problemId ?? null;
  }

  return null;
}

function isRegistered(items, problemId) {
  return items.some((item) => item.problemId === problemId);
}

export function createBookmarkController({
  reviewItemsStore,
  currentSuggestionStore,
  bookmarkView,
  getTodayLocalDate,
}) {
  function mount({ pageContext, locationHref }) {
    if (!pageContext?.isSupported || (pageContext.pageType !== 'problem' && pageContext.pageType !== 'submission-detail')) {
      return { rendered: false, reason: 'unsupported-page' };
    }

    const problemId = resolveProblemId({ pageContext, locationHref });
    if (!problemId) {
      return { rendered: false, reason: 'problem-id-not-found' };
    }

    function render() {
      const items = reviewItemsStore.getAll();
      const registered = isRegistered(items, problemId);

      bookmarkView.renderToggle({
        problemId,
        isRegistered: registered,
        onToggle() {
          const latestItems = reviewItemsStore.getAll();
          if (isRegistered(latestItems, problemId)) {
            const filteredItems = latestItems.filter((item) => item.problemId !== problemId);
            const saveResult = reviewItemsStore.saveAll(filteredItems);
            if (!saveResult?.ok) {
              return { ok: false, changed: false, error: saveResult?.error };
            }

            const current = currentSuggestionStore?.get?.();
            if (current?.problemId === problemId) {
              const clearResult = currentSuggestionStore.clear();
              if (!clearResult?.ok) {
                return { ok: false, changed: true, error: clearResult?.error };
              }
            }

            render();
            return { ok: true, changed: true };
          }

          const saveResult = reviewItemsStore.saveAll([
            ...latestItems,
            { problemId, registeredAt: getTodayLocalDate() },
          ]);

          if (!saveResult?.ok) {
            return { ok: false, changed: false, error: saveResult?.error };
          }

          render();
          return { ok: true, changed: true };
        },
      });
    }

    render();
    return { rendered: true, problemId };
  }

  return {
    mount,
  };
}
