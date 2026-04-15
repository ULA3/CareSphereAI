'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, MessageCircle, Bell, LayoutDashboard, Heart, Zap, TrendingUp, MapPin, Pill, Users, FileText, Cpu, UserPlus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { lang, t, setLang } = useLanguage();

  const navItems = [
    { href: '/', label: t.dashboard, icon: LayoutDashboard },
    { href: '/companion', label: t.aiCompanion, icon: MessageCircle },
    { href: '/alerts', label: t.alerts, icon: Bell, badge: true },
    { href: '/trends', label: t.trends, icon: TrendingUp },
    { href: '/hospitals', label: t.hospitals, icon: MapPin },
    { href: '/medications', label: t.medications, icon: Pill },
    { href: '/caregiver', label: t.caregiver, icon: Users },
    { href: '/report', label: t.weeklyReport, icon: FileText },
    { href: '/devices', label: 'Device Monitor', icon: Cpu },
    { href: '/onboard', label: 'Add Patient', icon: UserPlus },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900/95 border-r border-gray-800 flex flex-col z-40 overflow-y-auto">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg glow-green shrink-0">
            <Heart className="w-5 h-5 text-white animate-heartbeat" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">CareSphere</h1>
            <p className="text-emerald-400 text-xs font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" /> AI-Powered
            </p>
          </div>
        </div>
        <p className="mt-2 text-gray-500 text-xs">
          Elderly Health Monitoring<br />
          <span className="text-emerald-600">Track 3: Vital Signs</span>
        </p>

        {/* Language Toggle */}
        <div className="mt-3 flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => setLang('en')}
            className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${lang === 'en' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            🇬🇧 EN
          </button>
          <button
            onClick={() => setLang('bm')}
            className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${lang === 'bm' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            🇲🇾 BM
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 px-3">Navigation</p>
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
              {badge && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                  !
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* AI Status */}
      <div className="p-3 border-t border-gray-800 shrink-0">
        <div className="glass-card p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Stack</p>
          <div className="space-y-1.5">
            {[
              { label: 'Gemini 2.5 Flash', status: 'Active' },
              { label: 'Genkit Flows', status: 'Ready' },
              { label: 'RAG Memory', status: 'Online' },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-blink" />
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-center text-gray-600 text-xs">
          Project 2030 · GDG UTM
        </p>
      </div>
    </aside>
  );
}
