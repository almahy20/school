import { useState, useEffect } from 'react';

/**
 * useSessionState - مثل useState لكن يحفظ القيمة في sessionStorage
 * تبقى القيمة محفوظة طوال الجلسة (حتى لو تنقلت بين الصفحات)
 * وتُمسح تلقائياً لما تقفل التاب/المتصفح
 */
export function useSessionState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // ignore parse errors
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore write errors
    }
  }, [key, state]);

  return [state, setState];
}
