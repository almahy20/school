import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { useSchoolFavicon } from "./hooks/queries";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./components/theme-provider";

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
const MessagingPage            = lazy(() => import("./pages/MessagingPage"));
const ParentMessagesPage       = lazy(() => import("./pages/ParentMessagesPage"));
const NotFound                 = lazy(() => import("./pages/NotFound"));
const ParentComplaintsPage     = lazy(() => import("./pages/ParentComplaintsPage"));
const AdminComplaintsPage      = lazy(() => import("./pages/AdminComplaintsPage"));
const AdminReportsPage         = lazy(() => import("./pages/AdminReportsPage"));
const LandingPage              = lazy(() => import("./pages/LandingPage"));
const PaymentPage              = lazy(() => import("./pages/PaymentPage"));
const SubscriptionExpiredPage  = lazy(() => import("./pages/SubscriptionExpiredPage"));
const SettingsPage             = lazy(() => import("./pages/SettingsPage"));
const WaitingApprovalPage      = lazy(() => import("./pages/WaitingApprovalPage"));
const StudentGradesPage        = lazy(() => import("./pages/StudentGradesPage"));
const StudentAttendancePage    = lazy(() => import("./pages/StudentAttendancePage"));
const StudentFinancialPage     = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentFinancialPage })));
const StudentCurriculumPage    = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentCurriculumPage })));
const StudentDataPage          = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentDataPage })));

// ── Lazy loaded global components ────────────────────────────────────────────
const RealtimeNotificationsManager = lazy(() => import('./components/RealtimeNotificationsManager'));
const PWAInstallPrompt             = lazy(() => import('./components/PWAInstallPrompt'));
const PwaManager                   = lazy(() => import('./components/PwaManager'));

// Only expose the developer portal in development builds
const isDev = import.meta.env.DEV;
const DeveloperSecretLogin = isDev
  ? lazy(() => import("./pages/DeveloperSecretLogin"))
  : null;

// ── App Routes ───────────────────────────────────────────────────────────────
// Smart router: shows admin broadcast page or parent inbox based on role
function MessagesRouter() {
  const { user } = useAuth();
  if (user?.role === 'parent') return <ParentMessagesPage />;
  return <MessagingPage />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  // Sync school favicon with branding
  useSchoolFavicon();

  return (
    <Suspense fallback={<div className="fixed inset-0 bg-transparent" />}>
      <Routes>
        {/* ── Public Routes ── */}
        <Route path="/home" element={<LandingPage />} />
        <Route path="/payment/:orderId" element={<PaymentPage />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/register/teachers/:school_slug" element={user ? <Navigate to="/" replace /> : <TeacherSignupPage />} />
        <Route path="/register/parents/:school_slug" element={user ? <Navigate to="/" replace /> : <ParentSignupPage />} />
        {isDev && DeveloperSecretLogin && (
          <Route path="/dev-secret-portal" element={<DeveloperSecretLogin />} />
        )}

        {/* ── Root: Landing for guests, Dashboard for logged-in users ── */}
        <Route
          path="/"
          element={
            loading && !user ? (
              <div className="fixed inset-0 bg-transparent" />
            ) : user ? (
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            ) : (
              <Navigate to="/home" replace />
            )
          }
        />

        {/* ── Protected Routes ── */}
        <Route path="/waiting-approval" element={<ProtectedRoute><WaitingApprovalPage /></ProtectedRoute>} />
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
        <Route path="/complaints"      element={<ProtectedRoute allowedRoles={['parent']}><ParentComplaintsPage /></ProtectedRoute>} />
        <Route path="/manage-complaints" element={<ProtectedRoute allowedRoles={['admin']}><AdminComplaintsPage /></ProtectedRoute>} />
        <Route path="/admin-reports"   element={<ProtectedRoute allowedRoles={['admin']}><AdminReportsPage /></ProtectedRoute>} />
        <Route path="/settings"        element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/expired"         element={<ProtectedRoute><SubscriptionExpiredPage /></ProtectedRoute>} />

        {/* ── Parent child detail routes ── */}
        <Route path="/parent/children/:id"            element={<ProtectedRoute allowedRoles={['parent']}><ParentChildDetailPage /></ProtectedRoute>} />
        <Route path="/parent/children/:id/grades"     element={<ProtectedRoute allowedRoles={['parent']}><StudentGradesPage /></ProtectedRoute>} />
        <Route path="/parent/children/:id/attendance" element={<ProtectedRoute allowedRoles={['parent']}><StudentAttendancePage /></ProtectedRoute>} />
        <Route path="/parent/children/:id/financial"  element={<ProtectedRoute allowedRoles={['parent']}><StudentFinancialPage /></ProtectedRoute>} />
        <Route path="/parent/children/:id/curriculum" element={<ProtectedRoute allowedRoles={['parent']}><StudentCurriculumPage /></ProtectedRoute>} />
        <Route path="/parent/children/:id/data"       element={<ProtectedRoute allowedRoles={['parent']}><StudentDataPage /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ScrollToTop />
              <GlobalErrorBoundary>
                <AppRoutes />
                <PwaManager />
                <PWAInstallPrompt />
              </GlobalErrorBoundary>
              <Toaster />
              {/* RealtimeNotificationsManager must be inside BrowserRouter for useNavigate */}
              <Suspense fallback={null}>
                <RealtimeNotificationsManager />
              </Suspense>
              <Sonner position="top-center" dir="rtl" expand={true} richColors />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
