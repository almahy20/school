/**
 * usePWAInstall — hook مركزي لإدارة حدث beforeinstallprompt
 *
 * يُسجَّل listener مرة واحدة على مستوى الـ window وبيحفظ الـ prompt
 * في module-level variable عشان يكون متاح من أي component أو page.
 */

import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';

// Module-level — يُشارك بين كل instances للـ hook
let _deferredPrompt: any = null;
const _listeners = new Set<() => void>();

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

// تسجيل listener مرة واحدة فقط على مستوى الـ module
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    _deferredPrompt = e;
    (window as any).deferredPrompt = e; // backward compat
    logger.log('✅ [usePWAInstall] beforeinstallprompt captured');
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    (window as any).deferredPrompt = null;
    logger.log('✅ [usePWAInstall] App installed — prompt cleared');
    notifyListeners();
  });
}

export interface PWAInstallState {
  canInstall: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePWAInstall(): PWAInstallState {
  const [, forceUpdate] = useState(0);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

  useEffect(() => {
    // تحقق فوري من window.deferredPrompt (قد يكون حُفظ في main.tsx)
    if ((window as any).deferredPrompt && !_deferredPrompt) {
      _deferredPrompt = (window as any).deferredPrompt;
      logger.log('✅ [usePWAInstall] Picked up deferredPrompt from window');
      forceUpdate(n => n + 1);
    }

    // re-render عند تغيير الـ prompt (captured or cleared)
    const update = () => forceUpdate(n => n + 1);
    _listeners.add(update);
    return () => { _listeners.delete(update); };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    // حاول تجيب الـ prompt من كل الأماكن الممكنة
    const prompt = _deferredPrompt || (window as any).deferredPrompt;

    if (!prompt) {
      logger.warn('[usePWAInstall] No deferredPrompt available');
      return 'unavailable';
    }

    try {
      prompt.prompt();

      // بعض المتصفحات لا تُكمل userChoice؛ لا نترك واجهة التثبيت معلقة.
      let timeoutId: number | undefined;
      const timeout = new Promise<{ outcome: 'dismissed' }>((resolve) => {
        timeoutId = window.setTimeout(() => resolve({ outcome: 'dismissed' }), 5000);
      });
      const { outcome } = await Promise.race([Promise.resolve(prompt.userChoice), timeout]);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      logger.log('[usePWAInstall] User choice:', outcome);

      if (outcome === 'accepted') {
        _deferredPrompt = null;
        (window as any).deferredPrompt = null;
        notifyListeners();
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      logger.error('[usePWAInstall] prompt() error:', err);
      return 'unavailable';
    }
  };

  return {
    canInstall: !isStandalone && !!(_deferredPrompt || (window as any).deferredPrompt),
    isStandalone,
    promptInstall,
  };
}
