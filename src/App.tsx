import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PwaManager from "./components/PwaManager";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { HealthMonitor } from "./components/HealthMonitor";

// Lazy Load Pages
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TeacherSignupPage = lazy(() => import("./pages/TeacherSignupPage"));
const ParentSignupPage = lazy(() => import("./pages/ParentSignupPage"));
const DeveloperSecretLogin = lazy(() => import("./pages/DeveloperSecretLogin"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const StudentDetailPage = lazy(() => import("./pages/StudentDetailPage"));
const TeachersPage = lazy(() => import("./pages/TeachersPage"));
const TeacherDetailPage = lazy(() => import("./pages/TeacherDetailPage"));
const SuperAdminPage = lazy(() => import("./pages/SuperAdminPage"));
const ParentsPage = lazy(() => import("./pages/ParentsPage"));
const ParentDetailPage = lazy(() => import("./pages/ParentDetailPage"));
const ClassesPage = lazy(() => import("./pages/ClassesPage"));
const ClassDetailPage = lazy(() => import("./pages/ClassDetailPage"));

const CurriculumManagementPage = lazy(() => import("./pages/CurriculumManagementPage"));
const GradesPage = lazy(() => import("./pages/GradesPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const FeesPage = lazy(() => import("./pages/FeesPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ParentChildDetailPage = lazy(() => import("./pages/ParentChildDetailPage"));
const UsersManagementPage = lazy(() => import("./pages/UsersManagementPage"));
const DatabasePage = lazy(() => import("./pages/DatabasePage"));
const MessagingPage = lazy(() => import("./pages/MessagingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ParentComplaintsPage = lazy(() => import("./pages/ParentComplaintsPage"));
const AdminComplaintsPage = lazy(() => import("./pages/AdminComplaintsPage"));

const LandingPage = lazy(() => import("./pages/LandingPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const SubscriptionExpiredPage = lazy(() => import("./pages/SubscriptionExpiredPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const WaitingApprovalPage = lazy(() => import("./pages/WaitingApprovalPage"));
import PwaOnboarding from "./components/PwaOnboarding";
import RealtimeNotificationsManager from "./components/RealtimeNotificationsManager";

import { queryClient } from "./lib/queryClient";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <PwaManager />
      <HealthMonitor />
      <PwaOnboarding />
      <RealtimeNotificationsManager />
      <Suspense fallback={
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" dir="rtl">
           <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      }>
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
          <Route path="/waiting-approval" element={<ProtectedRoute><WaitingApprovalPage /></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute isSuperAdminOnly><SuperAdminPage /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><StudentsPage /></ProtectedRoute>} />
          <Route path="/students/:id" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><StudentDetailPage /></ProtectedRoute>} />
          <Route path="/teachers" element={<ProtectedRoute allowedRoles={['admin']}><TeachersPage /></ProtectedRoute>} />
          <Route path="/teachers/:id" element={<ProtectedRoute allowedRoles={['admin']}><TeacherDetailPage /></ProtectedRoute>} />
          <Route path="/parents" element={<ProtectedRoute allowedRoles={['admin']}><ParentsPage /></ProtectedRoute>} />
          <Route path="/parents/:id" element={<ProtectedRoute allowedRoles={['admin']}><ParentDetailPage /></ProtectedRoute>} />
          <Route path="/classes" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassesPage /></ProtectedRoute>} />
          <Route path="/classes/:id" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassDetailPage /></ProtectedRoute>} />
          <Route path="/curriculum-management" element={<ProtectedRoute allowedRoles={['admin']}><CurriculumManagementPage /></ProtectedRoute>} />

          <Route path="/grades" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><GradesPage /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AttendancePage /></ProtectedRoute>} />
          <Route path="/fees" element={<ProtectedRoute allowedRoles={['admin']}><FeesPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
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
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <GlobalErrorBoundary>
              <AppRoutes />
            </GlobalErrorBoundary>
            <Toaster />
            <Sonner position="top-center" dir="rtl" expand={true} richColors />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
