import { useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { TeacherDashboard } from '@/components/dashboard/TeacherDashboard';
import { ParentDashboard } from '@/components/dashboard/ParentDashboard';

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
        {user?.role === 'parent' ? <ParentDashboard />
          : user?.role === 'teacher' ? <TeacherDashboard />
          : user?.role === 'admin' ? <AdminDashboard />
          : null}
      </div>
    </AppLayout>
  );
}
