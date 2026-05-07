import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top of window immediately
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
    
    // Also scroll the main content area if it has its own scrollbar
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant",
      });
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
