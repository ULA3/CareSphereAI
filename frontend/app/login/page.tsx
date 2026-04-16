'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Eye, EyeOff, Lock, Mail, Zap, Activity, Brain } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise((r) => setTimeout(r, 600)); // simulate network
    const ok = login(email, password);
    if (ok) {
      router.push('/');
    } else {
      setError('Invalid email or password. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-500 via-teal-500 to-teal-600 flex-col items-center justify-center p-12 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-white"
              style={{ width: `${(i+1)*120}px`, height: `${(i+1)*120}px`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          ))}
        </div>
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-6 shadow-xl">
            <Heart className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">CareSphere AI</h1>
          <p className="text-white/80 text-lg mb-8">Malaysia Elderly Health Monitoring</p>
          <div className="space-y-3 text-left bg-white/10 rounded-2xl p-5 backdrop-blur">
            {[
              { icon: Zap, label: 'Gemini 2.5 Flash AI', desc: 'Real-time risk assessment' },
              { icon: Activity, label: 'Vital Signs Monitoring', desc: '1,000 patients tracked 24/7' },
              { icon: Brain, label: 'Agentic AI', desc: 'Autonomous caregiver alerts' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-white/70 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-white/60 text-sm mt-8">Project 2030 · MyAI Future Hackathon · Track 3</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900">CareSphere AI</p>
              <p className="text-xs text-teal-600">Malaysia Elderly Health</p>
            </div>
          </div>

          <div className={`bg-white rounded-2xl border border-slate-200 shadow-xl p-8 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm mb-7">Sign in to your CareSphere dashboard</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                  <span>⚠</span> {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 bg-slate-50"
                    placeholder="admin@caresphere.my"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 bg-slate-50"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-brand-500 to-teal-500 text-white rounded-xl font-semibold text-sm hover:from-brand-600 hover:to-teal-600 disabled:opacity-60 transition-all shadow-md mt-2"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
