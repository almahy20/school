import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { getCachedUser } from "@/lib/userCache";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import ScrollToTop from "./components/ScrollToTop";
import { queryClient, persistOptions } from "./lib/queryClient";
import { ThemeProvider } from "./components/theme-provider";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import PwaManager from "./components/PwaManager";
import { PushNotificationProvider } from "./hooks/usePushNotifications";
function RouteLoadingBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 overflow-hidden bg-transparent pointer-events-none" aria-hidden="true">
      <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400 animate-[shimmer_1.2s_ease-in-out_infinite] origin-left shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
    </div>
  );
}

// ── Eagerly loaded (critical path) ──────────────────────────────────────────
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

// ── Lazy loaded pages ────────────────────────────────────────────────────────
const OnboardingPage           = lazy(() => import("./pages/OnboardingPage"));
const TeacherSignupPage        = lazy(() => import("./pages/TeacherSignupPage"));
const ParentSignupPage         = lazy(() => import("./pages/ParentSignupPage"));
const StudentsPage             = lazy(() => import("./pages/StudentsPage"));
const StudentDetailPage        = lazy(() => import("./pages/StudentDetailPage"));
const TeachersPage             = lazy(() => import("./pages/TeachersPage"));
const TeacherDetailPage        = lazy(() => import("./pages/TeacherDetailPage"));
const SuperAdminPage           = lazy(() => import("./pages/SuperAdminPage"));
const ParentsPage              = lazy(() => import("./pages/ParentsPage"));
const ParentDetailPage         = lazy(() => import("./pages/ParentDetailPage"));
const ClassesPage              = lazy(() => import("./pages/ClassesPage"));
const ClassDetailPage          = lazy(() => import("./pages/ClassDetailPage"));
const AttendancePage           = lazy(() => import("./pages/AttendancePage"));
const FeesPage                 = lazy(() => import("./pages/FeesPage"));
const NotificationsPage        = lazy(() => import("./pages/NotificationsPage"));
const ParentChildDetailPage    = lazy(() => import("./pages/ParentChildDetailPage"));
const UsersManagementPage      = lazy(() => import("./pages/UsersManagementPage"));
const DataRetentionSettingsPage = lazy(() => import("./pages/DataRetentionSettingsPage"));
const NotFound                 = lazy(() => import("./pages/NotFound"));
const ParentConversationsPage  = lazy(() => import("./pages/ParentConversationsPage"));
const AdminConversationsPage        = lazy(() => import("./pages/AdminConversationsPage"));
const AdminConversationDetailPage   = lazy(() => import("./pages/AdminConversationDetailPage"));
const AdminClassChatRoomPage        = lazy(() => import("./pages/AdminClassChatRoomPage"));
const ClassChatRoomPage             = lazy(() => import("./pages/ClassChatRoomPage"));
const ParentExamsPage          = lazy(() => import("./pages/ParentExamsPage"));
const PaymentPage              = lazy(() => import("./pages/PaymentPage"));
const SubscriptionExpiredPage  = lazy(() => import("./pages/SubscriptionExpiredPage"));
const SettingsPage             = lazy(() => import("./pages/SettingsPage"));
const StudentGradesPage        = lazy(() => import("./pages/StudentGradesPage"));
const StudentAttendancePage    = lazy(() => import("./pages/StudentAttendancePage"));
const StudentFinancialPage     = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentFinancialPage })));
const StudentCurriculumPage    = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentCurriculumPage })));
const StudentDataPage          = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentDataPage })));

// ── Lazy loaded global components ────────────────────────────────────────────
const RealtimeNotificationsManager = lazy(() => import('./components/RealtimeNotificationsManager'));

// Only expose the developer portal in development builds
const isDev = import.meta.env.DEV;
const DeveloperSecretLogin = isDev
  ? lazy(() => import("./pages/DeveloperSecretLogin"))
  : null;

// ── App Routes ───────────────────────────────────────────────────────────────
// Smart router: shows conversations page for both admin and parent
function MessagesRouter() {
  const { user } = useAuth();
  if (user?.role === 'parent') return <Navigate to="/conversations" replace />;
  return <Navigate to="/manage-conversations" replace />;
}

function AppRoutes() {
  const { user, isLoading: loading } = useAuth();

  // Sync school favicon with branding — handled by PwaManager
  return (
    <Suspense fallback={<RouteLoadingBar />}>
      <Routes>
        {/* ── Public & Standalone Routes ── */}
        <Route path="/home" element={<Navigate to="/login" replace />} />
        <Route path="/payment/:orderId" element={<PaymentPage />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <ParentSignupPage />} />
        <Route path="/register/teachers/:school_slug" element={user ? <Navigate to="/" replace /> : <TeacherSignupPage />} />
        <Route path="/register/parents/:school_slug" element={user ? <Navigate to="/" replace /> : <ParentSignupPage />} />
        {isDev && DeveloperSecretLogin && (
          <Route path="/dev-secret-portal" element={<DeveloperSecretLogin />} />
        )}
        <Route path="/waiting-approval" element={<Navigate to="/" replace />} />
        <Route path="/expired"         element={<ProtectedRoute><SubscriptionExpiredPage /></ProtectedRoute>} />

        {/* ── Authenticated App Layout (Persistent Frame with Outlet) ── */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/onboarding"       element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/super-admin"      element={<ProtectedRoute isSuperAdminOnly><SuperAdminPage /></ProtectedRoute>} />

          <Route path="/students"     element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><StudentsPage /></ProtectedRoute>} />
          <Route path="/students/:id" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><StudentDetailPage /></ProtectedRoute>} />
          <Route path="/teachers"     element={<ProtectedRoute allowedRoles={['admin']}><TeachersPage /></ProtectedRoute>} />
          <Route path="/teachers/:id" element={<ProtectedRoute allowedRoles={['admin']}><TeacherDetailPage /></ProtectedRoute>} />
          <Route path="/parents"      element={<ProtectedRoute allowedRoles={['admin']}><ParentsPage /></ProtectedRoute>} />
          <Route path="/parents/:id"  element={<ProtectedRoute allowedRoles={['admin']}><ParentDetailPage /></ProtectedRoute>} />
          <Route path="/classes"      element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassesPage /></ProtectedRoute>} />
          <Route path="/classes/:id"  element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassDetailPage /></ProtectedRoute>} />

          <Route path="/attendance"      element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AttendancePage /></ProtectedRoute>} />
          <Route path="/fees"            element={<ProtectedRoute allowedRoles={['admin']}><FeesPage /></ProtectedRoute>} />
          <Route path="/notifications"   element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/messages"        element={<ProtectedRoute allowedRoles={['admin', 'parent']}><MessagesRouter /></ProtectedRoute>} />
          <Route path="/users"           element={<ProtectedRoute allowedRoles={['admin']}><UsersManagementPage /></ProtectedRoute>} />
          <Route path="/data-retention"  element={<ProtectedRoute allowedRoles={['admin']}><DataRetentionSettingsPage /></ProtectedRoute>} />

          {/* ── New Conversations System ── */}
          <Route path="/conversations"       element={<ProtectedRoute allowedRoles={['parent']}><ParentConversationsPage /></ProtectedRoute>} />
          <Route path="/conversations/class/:roomId" element={<ProtectedRoute allowedRoles={['parent']}><ClassChatRoomPage /></ProtectedRoute>} />
          <Route path="/manage-conversations/class/:roomId" element={<ProtectedRoute allowedRoles={['admin']}><AdminClassChatRoomPage /></ProtectedRoute>} />
          <Route path="/manage-conversations" element={<ProtectedRoute allowedRoles={['admin']}><AdminConversationsPage /></ProtectedRoute>} />
          <Route path="/manage-conversations/:id" element={<ProtectedRoute allowedRoles={['admin']}><AdminConversationDetailPage /></ProtectedRoute>} />

          {/* ── Electronic Exams ── */}
          <Route path="/exams" element={<ProtectedRoute allowedRoles={['parent']}><ParentExamsPage /></ProtectedRoute>} />
          <Route path="/settings"        element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

          {/* ── Parent child detail routes ── */}
          <Route path="/parent/children/:id"            element={<ProtectedRoute allowedRoles={['parent']}><ParentChildDetailPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/grades"     element={<ProtectedRoute allowedRoles={['parent']}><StudentGradesPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/attendance" element={<ProtectedRoute allowedRoles={['parent']}><StudentAttendancePage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/financial"  element={<ProtectedRoute allowedRoles={['parent']}><StudentFinancialPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/curriculum" element={<ProtectedRoute allowedRoles={['parent']}><StudentCurriculumPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/data"       element={<ProtectedRoute allowedRoles={['parent']}><StudentDataPage /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

// ── Page Chunks Prefetcher (Idle Time) ───────────────────────────────────────
function prefetchCriticalPages() {
  const prefetch = () => {
    import("./pages/StudentsPage");
    import("./pages/ClassesPage");
    import("./pages/TeachersPage");
    import("./pages/ParentsPage");
    import("./pages/AttendancePage");
    import("./pages/NotificationsPage");
    import("./pages/SettingsPage");
    import("./pages/FeesPage");
  };
  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetch, { timeout: 4000 });
    } else {
      setTimeout(prefetch, 2000);
    }
  }
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    prefetchCriticalPages();
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <AuthProvider>
            <PushNotificationProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ScrollToTop />
                <AppRoutes />
                <PwaManager />
                <PWAInstallPrompt />
              <Toaster />
              {/* RealtimeNotificationsManager must be inside BrowserRouter for useNavigate */}
              <Suspense fallback={null}>
                <RealtimeNotificationsManager />
              </Suspense>
              <Sonner position="top-center" dir="rtl" expand={true} richColors />
              </BrowserRouter>
            </PushNotificationProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
      {/* React Query Devtools — dev only, لا تظهر في production */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
    </PersistQueryClientProvider>
  );
}
