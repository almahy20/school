import type { QueryClient } from '@tanstack/react-query';
import type { AppUser } from '@/types/auth';

// ── 1. Page Chunk Loaders ───────────────────────────────────────────────────
// ملاحظة: الصفحة الرئيسية DashboardPage محملة مسبقاً في المسار الحرج (Critical path) داخل App.tsx
const chunkLoaders: Record<string, () => Promise<any>> = {
  '/students': () => import('@/pages/StudentsPage'),
  '/classes': () => import('@/pages/ClassesPage'),
  '/teachers': () => import('@/pages/TeachersPage'),
  '/parents': () => import('@/pages/ParentsPage'),
  '/attendance': () => import('@/pages/AttendancePage'),
  '/fees': () => import('@/pages/FeesPage'),
  '/settings': () => import('@/pages/SettingsPage'),
  '/manage-conversations': () => import('@/pages/AdminConversationsPage'),
  '/conversations': () => import('@/pages/ParentConversationsPage'),
  '/exams': () => import('@/pages/ParentExamsPage'),
  '/notifications': () => import('@/pages/NotificationsPage'),
  '/users': () => import('@/pages/UsersManagementPage'),
  '/super-admin': () => import('@/pages/SuperAdminPage'),
};

const prefetchedRoutes = new Set<string>();

/**
 * Prefetches both the page JS bundle chunk and its core query data
 * when the user intends to navigate (onMouseEnter or onTouchStart).
 */
export function prefetchRoute(route: string, queryClient?: QueryClient, user?: AppUser | null) {
  // Avoid prefetching on slow connections or when data saver mode is enabled
  if (typeof navigator !== 'undefined') {
    const conn = (navigator as any).connection;
    if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') {
      return;
    }
  }

  // Always trigger chunk import
  const loader = chunkLoaders[route];
  if (loader && !prefetchedRoutes.has(route)) {
    prefetchedRoutes.add(route);
    loader().catch(() => {
      prefetchedRoutes.delete(route);
    });
  }

  // Note: Query prefetching without queryFn triggers "Error: Missing queryFn" in TanStack Query v5.
  // Code chunk prefetching above is completely safe and makes page loading near-instant.
  return;
}
