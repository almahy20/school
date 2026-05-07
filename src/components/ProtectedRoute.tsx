import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/auth';
import { ReactNode } from 'react';
// import { PageLoader } from '@/components/ui/PageLoader';

interface Props {
  children: ReactNode;
  allowedRoles?: AppRole[];
  isSuperAdminOnly?: boolean;
}

export default function ProtectedRoute({ children, allowedRoles, isSuperAdminOnly }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasCachedUser = !!localStorage.getItem('app_user_cache');
  
  // ✅ Optimization: If we have a cached user, don't show null during background loading.
  // This keeps the page "present" during refresh.
  if (loading && !hasCachedUser) {
    return <div className="fixed inset-0 bg-transparent border-none" />;
  }
  
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  // 1. Check Approval Status
  if (user.approvalStatus === 'pending' && location.pathname !== '/waiting-approval') {
    return <Navigate to="/waiting-approval" replace />;
  }
  
  // If user is approved but trying to access waiting page, send them back
  if (user.approvalStatus === 'approved' && location.pathname === '/waiting-approval') {
    return <Navigate to="/" replace />;
  }

  if (isSuperAdminOnly && !user.isSuperAdmin) return <Navigate to="/" replace />;

  // Redirect to /expired if subscription has ended (Admins/Teachers only)
  if (user.subscriptionExpired && !user.isSuperAdmin && (user.role === 'admin' || user.role === 'teacher')) {
    if (location.pathname !== '/settings' && location.pathname !== '/expired') {
       return <Navigate to="/expired" replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && !user.isSuperAdmin) return <Navigate to="/" replace />;
  
  if (user.schoolStatus === 'suspended' && !user.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center" dir="rtl">
         <div className="bg-card p-10 rounded-3xl shadow-xl max-w-md border border-border">
            <h1 className="text-3xl font-black text-foreground mb-4 tracking-tight">الاشتراك موقوف</h1>
            <p className="text-muted-foreground font-bold mb-8">عذراً، تم إيقاف الاشتراك الخاص بمدرستك. يرجى التواصل مع إدارة النظام للمزيد من التفاصيل.</p>
            <button onClick={() => navigate('/login', { replace: true })} className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-black hover:opacity-90 transition-all">العودة لتسجيل الدخول</button>
         </div>
      </div>
    );
  }

  return <>{children}</>;
}
