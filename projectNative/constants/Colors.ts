/**
 * نظام الألوان الاحترافي للتطبيق
 * مبني على نظام Design Tokens لضمان الاتساق
 */

export const Colors = {
  // ── Primary Brand ──────────────────────────────────────────────────────────
  primary: {
    50:  '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',  // Main brand color
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },

  // ── Semantic Colors ────────────────────────────────────────────────────────
  success: {
    light: '#dcfce7',
    main:  '#22c55e',
    dark:  '#15803d',
  },
  warning: {
    light: '#fef9c3',
    main:  '#eab308',
    dark:  '#a16207',
  },
  error: {
    light: '#fee2e2',
    main:  '#ef4444',
    dark:  '#b91c1c',
  },
  info: {
    light: '#dbeafe',
    main:  '#3b82f6',
    dark:  '#1d4ed8',
  },

  // ── Neutral ────────────────────────────────────────────────────────────────
  neutral: {
    0:   '#ffffff',
    50:  '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },

  // ── Light Theme ───────────────────────────────────────────────────────────
  light: {
    background:     '#f8fafc',
    surface:        '#ffffff',
    surfaceElevated:'#ffffff',
    border:         '#e2e8f0',
    borderLight:    '#f1f5f9',
    text:           '#0f172a',
    textSecondary:  '#475569',
    textMuted:      '#94a3b8',
    icon:           '#64748b',
    tabBar:         '#ffffff',
    tabBarBorder:   '#e2e8f0',
    card:           '#ffffff',
    cardBorder:     '#e2e8f0',
    input:          '#f8fafc',
    inputBorder:    '#e2e8f0',
    placeholder:    '#94a3b8',
    overlay:        'rgba(15, 23, 42, 0.5)',
    shimmer:        '#e2e8f0',
  },

  // ── Dark Theme ────────────────────────────────────────────────────────────
  dark: {
    background:     '#0f172a',
    surface:        '#1e293b',
    surfaceElevated:'#334155',
    border:         '#334155',
    borderLight:    '#1e293b',
    text:           '#f8fafc',
    textSecondary:  '#94a3b8',
    textMuted:      '#475569',
    icon:           '#94a3b8',
    tabBar:         '#1e293b',
    tabBarBorder:   '#334155',
    card:           '#1e293b',
    cardBorder:     '#334155',
    input:          '#0f172a',
    inputBorder:    '#334155',
    placeholder:    '#475569',
    overlay:        'rgba(0, 0, 0, 0.7)',
    shimmer:        '#334155',
  },

  // ── Role Colors ───────────────────────────────────────────────────────────
  roles: {
    admin:   { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
    teacher: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
    parent:  { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
    super:   { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
  },

  // ── Status Colors ─────────────────────────────────────────────────────────
  status: {
    present:  { bg: '#dcfce7', text: '#15803d' },
    absent:   { bg: '#fee2e2', text: '#b91c1c' },
    late:     { bg: '#fef9c3', text: '#a16207' },
    paid:     { bg: '#dcfce7', text: '#15803d' },
    unpaid:   { bg: '#fee2e2', text: '#b91c1c' },
    partial:  { bg: '#fef9c3', text: '#a16207' },
    pending:  { bg: '#fef9c3', text: '#a16207' },
    resolved: { bg: '#dcfce7', text: '#15803d' },
    active:   { bg: '#dbeafe', text: '#1d4ed8' },
    suspended:{ bg: '#fee2e2', text: '#b91c1c' },
  },
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = typeof Colors.light;
