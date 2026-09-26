/**
 * usePWAInstall — hook مركزي لإدارة حدث beforeinstallprompt
 *
 * يُسجَّل listener مرة واحدة على مستوى الـ window وبيحفظ الـ prompt
 * في module-level variable عشان يكون متاح من أي component أو page.
 *
 * ✅ مع تحسينات خاصة لـ Vercel:
 *    - استماع للأحداث المخصصة من main.tsx (pwa:*)
 *    - متابعة SW registration + polling تأكيدي للـ prompt
 */

import { useState, useEffect } from 'react';
import { logger } from '@/utils/logger';

// Module-level — يُشارك بين كل instances للـ hook
let _deferredPrompt: any = null;
const _listeners = new Set<() => void>();
let _pollingStarted = false;

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

function syncPromptFromWindow() {
  if ((window as any).deferredPrompt && !_deferredPrompt) {
    _deferredPrompt = (window as any).deferredPrompt;
    logger.log('✅ [usePWAInstall] Synced deferredPrompt from window.__pwaBoot');
    notifyListeners();
  }
  if ((window as any).__pwaBoot?.prompt && !_deferredPrompt) {
    _deferredPrompt = (window as any).__pwaBoot.prompt;
    logger.log('✅ [usePWAInstall] Synced deferredPrompt from __pwaBoot.prompt');
    notifyListeners();
  }
}

// تسجيل listeners مرة واحدة فقط على مستوى الـ module
if (typeof window !== 'undefined') {
  // 1) beforeinstallprompt — الأساسي
  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    _deferredPrompt = e;
    (window as any).deferredPrompt = e;
    if ((window as any).__pwaBoot) (window as any).__pwaBoot.prompt = e;
    logger.log('✅ [usePWAInstall] beforeinstallprompt captured (module level)');
    notifyListeners();
  });

  // 2) appinstalled
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    (window as any).deferredPrompt = null;
    if ((window as any).__pwaBoot) (window as any).__pwaBoot.prompt = null;
    logger.log('✅ [usePWAInstall] App installed — prompt cleared');
    notifyListeners();
  });

  // 3) أحداث مخصصة من main.tsx — مهمة للـ Vercel أحياناً prompt يأتي قبل الـ React mount
  window.addEventListener('pwa:prompt-ready', () => {
    logger.log('🟢 [usePWAInstall] Received pwa:prompt-ready');
    syncPromptFromWindow();
  });

  window.addEventListener('pwa:sw-registered', () => {
    logger.log('🟢 [usePWAInstall] Received pwa:sw-registered');
    syncPromptFromWindow();
    notifyListeners();
  });

  window.addEventListener('pwa:sw-ready', () => {
    logger.log('🟢 [usePWAInstall] Received pwa:sw-ready');
    syncPromptFromWindow();
    notifyListeners();
  });

  window.addEventListener('pwa:install-ready', () => {
    logger.log('🟢 [usePWAInstall] Received pwa:install-ready');
    syncPromptFromWindow();
    notifyListeners();
  });

  window.addEventListener('pwa:installed', () => {
    _deferredPrompt = null;
    (window as any).deferredPrompt = null;
    if ((window as any).__pwaBoot) (window as any).__pwaBoot.prompt = null;
    notifyListeners();
  });
}

/**
 * Polling تأكيدي: أحياناً على Vercel حدث beforeinstallprompt
 * يصير بعد interval يلي main.tsx بعمله، أو ما يصير أصلاً إلا بعد ما
 * يكون الـ SW موجود ويعمل fetch للموارد. هنا بنعمل polling لمدة 30 ثانية.
 */
function startPolling() {
  if (_pollingStarted) return;
  _pollingStarted = true;

  let tries = 0;
  const maxTries = 15; // 15 * 2000ms = 30 ثانية
  const interval = window.setInterval(() => {
    tries++;
    syncPromptFromWindow();
    if ((window as any).deferredPrompt || _deferredPrompt) {
      logger.log(`🟢 [usePWAInstall] Polling #${tries}: prompt found — stopping`);
      window.clearInterval(interval);
      notifyListeners();
    } else if (tries >= maxTries) {
      logger.warn(`🟡 [usePWAInstall] Polling ended after ${maxTries} tries — no prompt (iOS/Already Installed?)`);
      window.clearInterval(interval);
    }
  }, 2000);
}

export interface PWAInstallState {
  canInstall: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePWAInstall(): PWAInstallState {
  const [, forceUpdate] = useState(0);

  const isStandalone =
    typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

  const isIOS = typeof window !== 'undefined'
    ? /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    : false;

  // تشغيل فحوصات أولية وبدء الـ polling
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. sync فوري
    syncPromptFromWindow();

    // 2. تحقق من SW registration للـ log
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          logger.log('[usePWAInstall] SW registration present:', reg.scope);
          syncPromptFromWindow();
        } else if (import.meta.env.PROD) {
          logger.warn('[usePWAInstall] No SW registration — will retry');
        }
      }).catch(() => {});
    }

    // 3. بدء الـ polling
    startPolling();

    // 4. re-render عند أي تغيير في الـ global state
    const update = () => {
      syncPromptFromWindow();
      forceUpdate(n => n + 1);
    };
    _listeners.add(update);
    // أيضاً استدعاء update عند window focus (بعض الأجهزة بتطلق الحدث هنا فقط)
    window.addEventListener('focus', update);

    return () => {
      _listeners.delete(update);
      window.removeEventListener('focus', update);
    };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (typeof window === 'undefined') return 'unavailable';

    // حاول تجيب الـ prompt من كل الأماكن الممكنة
    const prompt = _deferredPrompt || (window as any).deferredPrompt || ((window as any).__pwaBoot?.prompt);

    if (!prompt) {
      logger.warn('[usePWAInstall] No deferredPrompt available — cannot call prompt()');
      return 'unavailable';
    }

    try {
      prompt.prompt();

      // بعض المتصفحات لا تُكمل userChoice؛ لا نترك واجهة التثبيت معلقة.
      let timeoutId: number | undefined;
      const timeout = new Promise<{ outcome: 'dismissed' }>((resolve) => {
        timeoutId = window.setTimeout(() => resolve({ outcome: 'dismissed' }), 8000);
      });
      const userChoicePromise = typeof prompt.userChoice === 'object' && prompt.userChoice?.then
        ? prompt.userChoice
        : Promise.resolve(prompt.userChoice || { outcome: 'accepted' });

      const { outcome } = await Promise.race([userChoicePromise, timeout]);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      logger.log('[usePWAInstall] User choice outcome:', outcome);

      if (outcome === 'accepted') {
        _deferredPrompt = null;
        (window as any).deferredPrompt = null;
        if ((window as any).__pwaBoot) (window as any).__pwaBoot.prompt = null;
        notifyListeners();
        return 'accepted';
      }
      return 'dismissed';
    } catch (err) {
      logger.error('[usePWAInstall] prompt() error:', err);
      return 'unavailable';
    }
  };

  const hasPrompt = !!(
    _deferredPrompt ||
    (typeof window !== 'undefined' && ((window as any).deferredPrompt || (window as any).__pwaBoot?.prompt))
  );

  return {
    canInstall: !isStandalone && hasPrompt,
    isStandalone,
    isIOS,
    promptInstall,
  };
}
