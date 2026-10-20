import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { TeacherDashboard } from '@/components/dashboard/TeacherDashboard';
import { ParentDashboard } from '@/components/dashboard/ParentDashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect to /super-admin if user is a pure platform Super Admin without an attached school
    if (user?.isSuperAdmin && !user?.schoolId) {
      navigate('/super-admin', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {user?.role === 'parent' ? <ParentDashboard />
        : user?.role === 'teacher' ? <TeacherDashboard />
        : (user?.role === 'admin' || user?.schoolId) ? <AdminDashboard />
        : null}
    </div>
  );
}
