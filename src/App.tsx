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

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user && !loading ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={user && !loading ? <Navigate to="/" replace /> : <SignupPage />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/super-admin" element={<ProtectedRoute><SuperAdminPage /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><StudentsPage /></ProtectedRoute>} />
      <Route path="/students/:id" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><StudentDetailPage /></ProtectedRoute>} />
      <Route path="/teachers" element={<ProtectedRoute allowedRoles={['admin']}><TeachersPage /></ProtectedRoute>} />
      <Route path="/teachers/:id" element={<ProtectedRoute allowedRoles={['admin']}><TeacherDetailPage /></ProtectedRoute>} />
      <Route path="/parents" element={<ProtectedRoute allowedRoles={['admin']}><ParentsPage /></ProtectedRoute>} />
      <Route path="/parents/:id" element={<ProtectedRoute allowedRoles={['admin']}><ParentDetailPage /></ProtectedRoute>} />
      <Route path="/classes" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassesPage /></ProtectedRoute>} />
      <Route path="/classes/:id" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ClassDetailPage /></ProtectedRoute>} />
      <Route path="/grades" element={<ProtectedRoute allowedRoles={['teacher']}><GradesPage /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin']}><AttendancePage /></ProtectedRoute>} />
      <Route path="/fees" element={<ProtectedRoute allowedRoles={['admin']}><FeesPage /></ProtectedRoute>} />
      <Route path="/parent/children/:id" element={<ProtectedRoute allowedRoles={['parent']}><ParentChildDetailPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UsersManagementPage /></ProtectedRoute>} />
      <Route path="/database" element={<ProtectedRoute allowedRoles={['admin']}><DatabasePage /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute allowedRoles={['admin']}><MessagingPage /></ProtectedRoute>} />
      <Route path="/complaints" element={<ProtectedRoute allowedRoles={['parent']}><ParentComplaintsPage /></ProtectedRoute>} />
      <Route path="/manage-complaints" element={<ProtectedRoute allowedRoles={['admin']}><AdminComplaintsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
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
