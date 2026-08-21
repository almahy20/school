import { useState, useCallback } from 'react';

const KEY = 'battery_guidance_dismissed_v1';

export function useAndroidBatteryGuide() {
  const isAndroid = /Android/.test(navigator.userAgent);
  const [showSheet, setShowSheet] = useState(false);

  const onPermissionGranted = useCallback(() => {
    if (!isAndroid) return;
    if (localStorage.getItem(KEY) !== 'true') setShowSheet(true);
  }, [isAndroid]);

  const dismiss = useCallback((permanent: boolean) => {
    if (permanent) localStorage.setItem(KEY, 'true');
    setShowSheet(false);
  }, []);

  return { showBatteryGuide: showSheet, onPermissionGranted, dismiss };
}
