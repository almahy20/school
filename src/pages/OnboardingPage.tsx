import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Users } from 'lucide-react';

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-primary mx-auto flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-4">مرحبًا بك، {user?.fullName}</h1>
        <p className="text-muted-foreground mb-2">
          تم إنشاء حسابك بنجاح كـ <strong>ولي أمر</strong>.
        </p>
        <p className="text-muted-foreground mb-8">
          سيقوم مدير المدرسة بربط أبنائك بحسابك. بعد ذلك ستتمكن من متابعة درجاتهم وحضورهم.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90"
        >
          الذهاب للوحة التحكم
        </button>
      </div>
    </AppLayout>
  );
}
