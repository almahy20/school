import type { QueryClient } from '@tanstack/react-query';
import type { AppUser } from '@/types/auth';

// ── 1. Page Chunk Loaders ───────────────────────────────────────────────────
const chunkLoaders: Record<string, () => Promise<any>> = {
  '/': () => import('@/pages/DashboardPage'),
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

  // Trigger query prefetching if queryClient and user are available
  if (!queryClient || !user) return;

  const schoolId = user.schoolId;
  const isSuperAdmin = user.isSuperAdmin;

  switch (route) {
    case '/': {
      if (user.role === 'admin' && schoolId) {
        queryClient.prefetchQuery({
          queryKey: ['admin-stats', 'summary', schoolId, user.id],
          staleTime: 5 * 60 * 1000,
        });
      } else if (user.role === 'teacher' && schoolId) {
        queryClient.prefetchQuery({
          queryKey: ['teacher-stats', user.id, schoolId],
          staleTime: 5 * 60 * 1000,
        });
      }
      break;
    }
    case '/students': {
      if (schoolId || isSuperAdmin) {
        queryClient.prefetchQuery({
          queryKey: ['students', 'list', 'v2', schoolId, user.role, user.id, 1, 15, '', 'الكل'],
          staleTime: 3 * 60 * 1000,
        });
        queryClient.prefetchQuery({
          queryKey: ['classes', 'all', schoolId, isSuperAdmin, user.role, user.id],
          staleTime: 3 * 60 * 1000,
        });
      }
      break;
    }
    case '/classes': {
      if (schoolId || isSuperAdmin) {
        queryClient.prefetchQuery({
          queryKey: ['classes', 'all', schoolId, isSuperAdmin, user.role, user.id],
          staleTime: 3 * 60 * 1000,
        });
        queryClient.prefetchQuery({
          queryKey: ['classes', 'student-counts', schoolId, user.role, user.id],
          staleTime: 3 * 60 * 1000,
        });
      }
      break;
    }
    case '/teachers': {
      if (schoolId || isSuperAdmin) {
        queryClient.prefetchQuery({
          queryKey: ['teachers', 'all', schoolId, isSuperAdmin],
          staleTime: 3 * 60 * 1000,
        });
      }
      break;
    }
    case '/parents': {
      if (schoolId && (user.role === 'admin' || isSuperAdmin)) {
        queryClient.prefetchQuery({
          queryKey: ['parents', 'all', schoolId],
          staleTime: 60 * 1000,
        });
      }
      break;
    }
    case '/attendance': {
      if (schoolId && (user.role === 'admin' || user.role === 'teacher' || isSuperAdmin)) {
        const today = new Date().toISOString().split('T')[0];
        queryClient.prefetchQuery({
          queryKey: ['teacher-attendance', schoolId, today],
          staleTime: 2 * 60 * 1000,
        });
      }
      break;
    }
    case '/manage-conversations': {
      if (schoolId && (user.role === 'admin' || isSuperAdmin)) {
        queryClient.prefetchQuery({
          queryKey: ['conversations', schoolId, 'all', 1, 15],
          staleTime: 30 * 1000,
        });
      }
      break;
    }
    case '/conversations': {
      if (user.id) {
        queryClient.prefetchQuery({
          queryKey: ['conversations', 'parent', user.id],
          staleTime: 30 * 1000,
        });
      }
      break;
    }
    case '/notifications': {
      if (user.id) {
        queryClient.prefetchQuery({
          queryKey: ['notifications', user.id],
          staleTime: 20 * 1000,
        });
      }
      break;
    }
  }
}
