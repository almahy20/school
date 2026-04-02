import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;

  // Redirect to /expired if subscription has ended (Admins/Teachers only)
  if (user.subscriptionExpired && !user.isSuperAdmin && (user.role === 'admin' || user.role === 'teacher')) {
    if (location.pathname !== '/settings' && location.pathname !== '/expired') {
       return <Navigate to="/expired" replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  
  if (user.schoolStatus === 'suspended' && !user.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center" dir="rtl">
         <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md border border-rose-100">
            <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">الاشتراك موقوف</h1>
            <p className="text-slate-500 font-bold mb-8">عذراً، تم إيقاف الاشتراك الخاص بمدرستك. يرجى التواصل مع إدارة النظام للمزيد من التفاصيل.</p>
            <button onClick={() => navigate('/login', { replace: true })} className="h-12 px-8 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all">العودة لتسجيل الدخول</button>
         </div>
      </div>
    );
  }

  return <>{children}</>;
}
