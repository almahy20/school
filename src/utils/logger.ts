/**
 * Centralized Logger Utility
 * 
 * Replaces console.log/warn in production to improve performance
 * Only outputs logs in development mode
 * Errors are always logged (even in production)
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * General logging - disabled in production
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Debug logging - disabled in production
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Warning logging - disabled in production
   */
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Error logging - ALWAYS enabled (critical for monitoring)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Info logging - disabled in production
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Performance logging - disabled in production
   */
  perf: (label: string, fn: () => void) => {
    if (!isDev) {
      fn();
      return;
    }

    const start = performance.now();
    fn();
    const end = performance.now();
    console.log(`⚡ [Performance] ${label}: ${(end - start).toFixed(2)}ms`);
  },
};
