import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { idbPersister } from "@/lib/queryPersister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import PwaManager from "./components/PwaManager";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLastSeenUpdate } from './hooks/useLastSeenUpdate';
import { InstallPWA } from './components/pwa/InstallPWA';
import { RefreshCw, X } from 'lucide-react';


// Lazy Load Pages
const LoginPage = lazy(() => import("./pages/LoginPage"));
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

const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const FeesPage = lazy(() => import("./pages/FeesPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ParentChildDetailPage = lazy(() => import("./pages/ParentChildDetailPage"));
const UsersManagementPage = lazy(() => import("./pages/UsersManagementPage"));
const DataRetentionSettingsPage = lazy(() => import("./pages/DataRetentionSettingsPage"));
const MessagingPage = lazy(() => import("./pages/MessagingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ParentComplaintsPage = lazy(() => import("./pages/ParentComplaintsPage"));
const AdminComplaintsPage = lazy(() => import("./pages/AdminComplaintsPage"));

const LandingPage = lazy(() => import("./pages/LandingPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const SubscriptionExpiredPage = lazy(() => import("./pages/SubscriptionExpiredPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const WaitingApprovalPage = lazy(() => import("./pages/WaitingApprovalPage"));
const StudentGradesPage = lazy(() => import("./pages/StudentGradesPage"));
const StudentAttendancePage = lazy(() => import("./pages/StudentAttendancePage"));
const StudentFinancialPage = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentFinancialPage })));
const StudentCurriculumPage = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentCurriculumPage })));
const StudentDataPage = lazy(() => import("./pages/StudentDetailPages").then((m: any) => ({ default: m.StudentDataPage })));
import PwaOnboarding from "./components/PwaOnboarding";
import RealtimeNotificationsManager from './components/RealtimeNotificationsManager';
import { queryClient } from "./lib/queryClient";

// القائمة الأساسية للجداول التي نحتاج لمراقبتها عالمياً (Global)
// تم تقليص القائمة لمنع استنزاف موارد المتصفح وتجمد الموقع
const GLOBAL_SYNC_TABLES = [
  'messages', 
  'notifications', 
  'profiles',
  'user_roles',
  'schools',
  'complaints',
  'grades',
  'attendance',
  'fees',
  'classes',
  'students'
];

import { PageLoader } from "./components/PageLoader";

function AppRoutes() {
  const { user } = useAuth();
  
  // تفعيل التزامن الفوري للجداول الأساسية فقط
  useRealtimeSync(GLOBAL_SYNC_TABLES, user?.schoolId);

  // تحديث "آخر ظهور" تلقائياً لضمان دقة عداد النشاط
  useLastSeenUpdate();

  // إدارة تحديثات التطبيق (حل مشكلة الكاش)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <>
      <PwaManager />
      <InstallPWA />
      
      {/* Update Prompt (Clears cache and forces new version) */}
      {needRefresh && (
        <div className="fixed top-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 z-[10000] animate-in slide-in-from-top-10">
          <div className="bg-slate-900 text-white px-5 py-4 rounded-3xl shadow-2xl flex items-center justify-between gap-6 border border-white/10 backdrop-blur-xl">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center animate-spin">
                   <RefreshCw className="w-5 h-5" />
                </div>
                <div className="text-right">
                   <p className="text-sm font-black">تحديث متاح!</p>
                   <p className="text-[10px] text-white/50 font-bold">إصدار جديد متوفر الآن</p>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => updateServiceWorker(true)}
                  className="bg-white text-slate-900 px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-50 transition-all active:scale-95 whitespace-nowrap"
                >
                  تحديث الآن
                </button>
                <button 
                  onClick={() => setNeedRefresh(false)}
                  className="p-2 text-white/30 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
             </div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
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

          <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AttendancePage /></ProtectedRoute>} />
          <Route path="/fees" element={<ProtectedRoute allowedRoles={['admin']}><FeesPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id" element={<ProtectedRoute allowedRoles={['parent']}><ParentChildDetailPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/grades" element={<ProtectedRoute allowedRoles={['parent']}><StudentGradesPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/attendance" element={<ProtectedRoute allowedRoles={['parent']}><StudentAttendancePage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/financial" element={<ProtectedRoute allowedRoles={['parent']}><StudentFinancialPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/curriculum" element={<ProtectedRoute allowedRoles={['parent']}><StudentCurriculumPage /></ProtectedRoute>} />
          <Route path="/parent/children/:id/data" element={<ProtectedRoute allowedRoles={['parent']}><StudentDataPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UsersManagementPage /></ProtectedRoute>} />
          <Route path="/data-retention" element={<ProtectedRoute allowedRoles={['admin']}><DataRetentionSettingsPage /></ProtectedRoute>} />
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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === 'success',
        },
      }}
    >
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <GlobalErrorBoundary>
              <div className="min-h-screen bg-[#f8fafc] selection:bg-indigo-500/10" dir="rtl">
                <Suspense fallback={<PageLoader />}>
                  <AppRoutes />
                </Suspense>
              </div>
            </GlobalErrorBoundary>
            <Toaster />
            <RealtimeNotificationsManager />
            <OfflineIndicator />
            <Sonner position="top-center" dir="rtl" expand={true} richColors />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}
