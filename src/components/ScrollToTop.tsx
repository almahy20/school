import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop
 * -----------
 * Resets scroll position on every route change.
 * Uses double-rAF to ensure the new page is painted before scrolling.
 * Note: scrollRestoration = 'manual' is set in main.tsx at app startup.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document.querySelectorAll('main').forEach(el => {
          (el as HTMLElement).scrollTop = 0;
        });
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
