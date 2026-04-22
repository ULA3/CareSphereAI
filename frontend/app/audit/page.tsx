'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, Brain, UserPlus, Activity,
  RefreshCw, Search, Filter, Clock, ChevronRight
} from 'lucide-react';
import { api, AuditEvent } from '@/lib/api';
import { format } from 'date-fns';

const EVENT_CONFIG: Record<AuditEvent['type'], { label: string; icon: React.ElementType; color: string; bg: string; darkBg: string }> = {
  risk_assessment:  { label: 'Risk Assessment', icon: Activity,      color: 'text-brand-600',  bg: 'bg-brand-50',   darkBg: 'dark:bg-brand-900/20' },
  caregiver_alert:  { label: 'Caregiver Alert', icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50',     darkBg: 'dark:bg-red-900/20' },
  ai_query:         { label: 'AI Clinical Query',icon: Brain,         color: 'text-purple-600', bg: 'bg-purple-50',  darkBg: 'dark:bg-purple-900/20' },
  patient_registered:{ label: 'Patient Registered', icon: UserPlus,  color: 'text-green-600',  bg: 'bg-green-50',   darkBg: 'dark:bg-green-900/20' },
};

const SEVERITY_COLORS = {
  info:     'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  warning:  'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  critical: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
};

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AuditEvent['type'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = filter !== 'all' ? filter : undefined;
      // Use a slightly hacky cast since the API returns { data, total }
      const raw = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/health/admin/audit?limit=200${typeParam ? `&type=${typeParam}` : ''}`);
      const json = await raw.json();
      setEvents(json.data || []);
      setTotal(json.total || 0);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const filtered = search.trim()
    ? events.filter((e) =>
        e.patientName.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase())
      )
    : events;

  const typeCount = (t: AuditEvent['type']) => events.filter((e) => e.type === t).length;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" />
            Audit Log
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {total.toLocaleString()} total events — all AI actions, alerts, and clinical queries
          </p>
        </div>
        <button onClick={fetchAudit} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient or event…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Type filters */}
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: 'all',               label: 'All',              count: total },
            { key: 'risk_assessment',   label: 'Assessments',      count: typeCount('risk_assessment') },
            { key: 'caregiver_alert',   label: 'Alerts',           count: typeCount('caregiver_alert') },
            { key: 'ai_query',          label: 'AI Queries',       count: typeCount('ai_query') },
            { key: 'patient_registered',label: 'Registrations',    count: typeCount('patient_registered') },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filter === key
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-300'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading audit events…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">No events found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
            <span>Type</span>
            <span>Description</span>
            <span>Patient</span>
            <span>Time</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[calc(100vh-22rem)] overflow-y-auto">
            {filtered.map((event) => {
              const cfg = EVENT_CONFIG[event.type];
              const Icon = cfg.icon;
              return (
                <div key={event.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3 items-start hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">

                  {/* Icon */}
                  <div className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.darkBg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>

                  {/* Description */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SEVERITY_COLORS[event.severity]}`}>
                        {event.severity}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{event.description}</p>
                  </div>

                  {/* Patient */}
                  <div className="text-right shrink-0">
                    <a href={`/patients/${event.patientId}`} className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5 justify-end">
                      {event.patientName.split(' ')[0]}
                      <ChevronRight className="w-3 h-3" />
                    </a>
                    <p className="text-[10px] text-slate-400">{event.patientId.replace('patient-', 'P-')}</p>
                  </div>

                  {/* Time */}
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {format(new Date(event.timestamp), 'HH:mm:ss')}
                    </p>
                    <p className="text-[10px] text-slate-400">{format(new Date(event.timestamp), 'dd MMM')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
