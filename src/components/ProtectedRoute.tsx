import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/auth';
import { ReactNode, useEffect } from 'react';
import { getCachedUser, setCachedUser } from '@/lib/userCache';

interface Props {
  children: ReactNode;
  allowedRoles?: AppRole[];
  isSuperAdminOnly?: boolean;
}

export default function ProtectedRoute({ children, allowedRoles, isSuperAdminOnly }: Props) {
  const { user, isLoading: loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // If user is already available, render immediately — don't wait for isLoading
  if (!user) {
    // ✅ لو loading — اعرض spinner
    if (loading) {
      return (
        <div className="fixed inset-0 bg-background flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      );
    }

    // ✅ لو مفيش user و loading خلص — الـ session منتهية
    // امسح الـ cache القديم وروح للـ login
    const cachedUser = getCachedUser();
    if (cachedUser) {
      // Cache موجود بس مفيش session حقيقية — امسحه وارجع للـ login
      setCachedUser(null);
    }

    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Approval check removed — all registered users are auto-approved.
  // If a specific school wants manual approval, re-enable this per school_id.

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
