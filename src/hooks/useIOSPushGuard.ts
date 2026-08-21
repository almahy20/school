export function useIOSPushGuard() {
  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;

  return {
    needsIOSGuidance: isIOS && !isStandalone,
    isIOSPWA: isIOS && isStandalone,
  };
}
