import { useEffect, lazy, Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// ✅ Optimization: Lazy load sub-dashboards to reduce initial bundle size
// This prevents Parents from downloading Admin/Teacher dashboard code.
const AdminDashboard = lazy(() => import('@/components/dashboard/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const TeacherDashboard = lazy(() => import('@/components/dashboard/TeacherDashboard').then(m => ({ default: m.TeacherDashboard })));
const ParentDashboard = lazy(() => import('@/components/dashboard/ParentDashboard').then(m => ({ default: m.ParentDashboard })));

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.isSuperAdmin) {
      navigate('/super-admin', { replace: true });
    }
  }, [user, navigate]);

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <Suspense fallback={null}>
          {user?.role === 'parent' ? <ParentDashboard />
            : user?.role === 'teacher' ? <TeacherDashboard />
            : user?.role === 'admin' ? <AdminDashboard />
            : null}
        </Suspense>
      </div>
    </AppLayout>
  );
}
