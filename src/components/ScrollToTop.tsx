import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop
 * -----------
 * Side-effect-only component: resets the WINDOW scroll position to the top
 * every time the user navigates to a new route (pathname changes).
 *
 * IMPORTANT NOTE (scroll containers):
 * -------------------------------------------------------------
 * This component ONLY controls the MAIN BROWSER WINDOW scroll (window.scrollTo).
 * It does NOT affect, and is NOT needed for, any internal scrollable elements
 * inside your UI that use `overflow: auto` / `overflow: scroll` on a fixed-size
 * container (e.g. a modal body, a custom scrollable Sidebar, a scrollable
 * card/table with max-height, a sheet/drawer content, etc.).
 *
 * For internal scroll containers you should:
 *   - Keep their own scroll state as-is (they are intentionally independent)
 *   - Or scroll them manually inside the specific modal/page component if you
 *     need to reset them (e.g. `myRef.current?.scrollTo({top:0, behavior:'instant'})`
 *     when that container's content changes).
 * -------------------------------------------------------------
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
