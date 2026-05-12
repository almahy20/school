import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { KeyRound, ShieldAlert } from 'lucide-react';

export default function DeveloperSecretLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err = await login(phone, password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      navigate('/super-admin');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden text-right">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
      
      <div className="w-full max-w-[400px] relative z-10 animate-in fade-in zoom-in duration-1000">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
            <KeyRound className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-widest mb-2 font-mono">DEVELOPER_PORTAL</h1>
          <p className="text-xs font-medium text-slate-500 font-mono tracking-widest uppercase">
            Restricted Access Zone
          </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-black/50 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-mono text-sm placeholder:text-slate-600"
                placeholder="Developer ID / Phone"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-black/50 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all font-mono text-sm placeholder:text-slate-600"
                placeholder="Secret Key"
                dir="ltr"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono p-3 rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-mono text-sm font-bold shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {loading ? 'AUTHENTICATING...' : 'INITIATE_SESSION'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
