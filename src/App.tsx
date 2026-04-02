import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import TeacherSignupPage from "./pages/TeacherSignupPage";
import ParentSignupPage from "./pages/ParentSignupPage";
import DeveloperSecretLogin from "./pages/DeveloperSecretLogin";
import StudentsPage from "./pages/StudentsPage";
import StudentDetailPage from "./pages/StudentDetailPage";
import TeachersPage from "./pages/TeachersPage";
import TeacherDetailPage from "./pages/TeacherDetailPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import ParentsPage from "./pages/ParentsPage";
import ParentDetailPage from "./pages/ParentDetailPage";
import ClassesPage from "./pages/ClassesPage";
import ClassDetailPage from "./pages/ClassDetailPage";
import GradesPage from "./pages/GradesPage";
import AttendancePage from "./pages/AttendancePage";
import FeesPage from "./pages/FeesPage";
import ParentChildDetailPage from "./pages/ParentChildDetailPage";
import UsersManagementPage from "./pages/UsersManagementPage";
import DatabasePage from "./pages/DatabasePage";
import SettingsPage from "./pages/SettingsPage";
import MessagingPage from "./pages/MessagingPage";
import NotFound from "./pages/NotFound";
import ParentComplaintsPage from "./pages/ParentComplaintsPage";
import AdminComplaintsPage from "./pages/AdminComplaintsPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import AssignmentSubmissionsPage from "./pages/AssignmentSubmissionsPage";
import LandingPage from "./pages/LandingPage";
import PaymentPage from "./pages/PaymentPage";
import SubscriptionExpiredPage from "./pages/SubscriptionExpiredPage";
import PwaManager from "./components/PwaManager";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060b16] flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 animate-spin" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">إدارة عربية</h2>
        <p className="text-white/40 text-sm font-bold uppercase tracking-widest animate-pulse">جاري التحقق من الهوية...</p>
      </div>
    );
  }

  return (
    <>
      <PwaManager />
      <Routes>
        {/* ── Public Routes ── */}
        <Route path="/home" element={<LandingPage />} />
        <Route path="/payment/:orderId" element={<PaymentPage />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/register/teachers/:school_slug" element={user ? <Navigate to="/" replace /> : <TeacherSignupPage />} />
        <Route path="/register/parents/:school_slug" element={user ? <Navigate to="/" replace /> : <ParentSignupPage />} />
        <Route path="/dev-secret-portal" element={<DeveloperSecretLogin />} />

        {/* ── Root: Landing for guests, Dashboard for logged in ── */}
        <Route path="/" element={user ? <ProtectedRoute><DashboardPage /></ProtectedRoute> : <LandingPage />} />

        {/* ── Protected Routes ── */}
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/super-admin" element={<ProtectedRoute><SuperAdminPage /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><StudentsPage /></ProtectedRoute>} />
        <Route path="/students/:id" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><StudentDetailPage /></ProtectedRoute>} />
        <Route path="/teachers" element={<ProtectedRoute allowedRoles={['admin']}><TeachersPage /></ProtectedRoute>} />
        <Route path="/teachers/:id" element={<ProtectedRoute allowedRoles={['admin']}><TeacherDetailPage /></ProtectedRoute>} />
        <Route path="/parents" element={<ProtectedRoute allowedRoles={['admin']}><ParentsPage /></ProtectedRoute>} />
        <Route path="/parents/:id" element={<ProtectedRoute allowedRoles={['admin']}><ParentDetailPage /></ProtectedRoute>} />
        <Route path="/classes" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassesPage /></ProtectedRoute>} />
        <Route path="/classes/:id" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassDetailPage /></ProtectedRoute>} />
        <Route path="/assignments" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'parent']}><AssignmentsPage /></ProtectedRoute>} />
        <Route path="/assignments/:id" element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'parent']}><AssignmentSubmissionsPage /></ProtectedRoute>} />
        <Route path="/grades" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><GradesPage /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AttendancePage /></ProtectedRoute>} />
        <Route path="/fees" element={<ProtectedRoute allowedRoles={['admin']}><FeesPage /></ProtectedRoute>} />
        <Route path="/parent/children/:id" element={<ProtectedRoute allowedRoles={['parent']}><ParentChildDetailPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UsersManagementPage /></ProtectedRoute>} />
        <Route path="/database" element={<ProtectedRoute allowedRoles={['admin']}><DatabasePage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute allowedRoles={['admin']}><MessagingPage /></ProtectedRoute>} />
        <Route path="/complaints" element={<ProtectedRoute allowedRoles={['parent']}><ParentComplaintsPage /></ProtectedRoute>} />
        <Route path="/manage-complaints" element={<ProtectedRoute allowedRoles={['admin']}><AdminComplaintsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/expired" element={<ProtectedRoute><SubscriptionExpiredPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
