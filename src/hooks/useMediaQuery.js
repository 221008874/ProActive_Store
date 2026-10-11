import { useCallback, useSyncExternalStore } from "react";

/**
 * Tracks a CSS media query from React.
 *
 * Used where two different components render the same controls and only one may
 * exist at a time — the shop's filter sidebar (desktop) and its filter sheet
 * (phone). Hiding one with CSS would leave both in the DOM, duplicating their
 * ids and doubling every input in the accessibility tree; rendering one of them
 * is the honest fix.
 *
 * `useSyncExternalStore` rather than useState + effect: the media query list is
 * an external store, and this reads it without a render-then-update pass, so
 * the first paint already has the right branch and no cascading render follows.
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // getServerSnapshot is what a pre-hydration render would read; the storefront
  // is rendered to a string in its smoke tests, where `window` does not exist.
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The store's desktop breakpoint: the phone layout folds to the grid here. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

export default useMediaQuery;