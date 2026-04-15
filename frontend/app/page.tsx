'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, Users, Shield, RefreshCw, Zap,
  Play, Square, CheckCircle2, Search, Filter, SlidersHorizontal,
} from 'lucide-react';
import { api, DashboardStats, RiskAssessment } from '@/lib/api';
import PatientCard from '@/components/dashboard/PatientCard';
import RiskChart from '@/components/dashboard/RiskChart';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function DashboardContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();

  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [allAssessments, setAllAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [simLoading, setSimLoading]     = useState(false);
  const [autoSim, setAutoSim]           = useState(false);
  const [autoSimToggling, setAutoSimToggling] = useState(false);
  const [lastUpdate, setLastUpdate]     = useState<Date>(new Date());
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [riskFilter, setRiskFilter]     = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [nameFilter, setNameFilter]     = useState('');
  const [highlightId]                   = useState(searchParams.get('highlight') || '');

  const fetchData = useCallback(async () => {
    try {
      const [statsData, assessData] = await Promise.all([
        api.getDashboardStats(),
        api.getAllAssessments(),
      ]);
      setStats(statsData);
      setAllAssessments(assessData);
      setAutoSim(statsData.autoSimEnabled);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, autoSim ? 15000 : 30000);
    return () => clearInterval(interval);
  }, [fetchData, autoSim]);

  const handleSimulate = async (patientId: string, scenario: 'normal' | 'warning' | 'critical') => {
    setSimLoading(true);
    try {
      const result = await api.simulate(patientId, scenario);
      const a = result.assessment;
      const type = a.riskLevel === 'high' ? 'error' : a.riskLevel === 'medium' ? 'warning' : 'success';
      let msg = `${scenario.toUpperCase()} → ${a.riskLevel.toUpperCase()} risk (score: ${a.riskScore})`;
      if (result.anomalies?.length > 0) msg += ' ⚠ Baseline anomaly!';
      if (a.riskLevel !== 'low') msg += ' — Agent actions triggered.';
      setNotification({ msg, type });
      await fetchData();
      setTimeout(() => setNotification(null), 7000);
    } catch (err) {
      setNotification({ msg: `Simulation failed: ${err}`, type: 'error' });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setSimLoading(false);
    }
  };

  const handleAutoSimToggle = async () => {
    setAutoSimToggling(true);
    try {
      if (autoSim) {
        await api.stopAutoSim();
        setAutoSim(false);
        setNotification({ msg: 'Auto-simulation stopped.', type: 'success' });
      } else {
        await api.startAutoSim();
        setAutoSim(true);
        setNotification({ msg: 'Auto-simulation started — new readings every 30s.', type: 'success' });
      }
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      setNotification({ msg: `Auto-sim error: ${err}`, type: 'error' });
    } finally {
      setAutoSimToggling(false);
    }
  };

  // Filter patients shown on dashboard
  const filteredPatients = (stats?.patientsWithReadings || []).filter(({ patient, latestAssessment }) => {
    if (riskFilter !== 'all' && latestAssessment?.riskLevel !== riskFilter) return false;
    if (nameFilter && !patient.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Toast Notification ────────────────────────────────────── */}
      {notification && (
        <div className={`fixed top-20 right-4 z-50 max-w-sm p-4 rounded-xl border shadow-card-lg animate-slide-up flex items-start gap-3 ${
          notification.type === 'error'   ? 'bg-red-50 border-red-200 text-red-800' :
          notification.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-green-50 border-green-200 text-green-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <p className="text-sm font-medium">{notification.msg}</p>
        </div>
      )}

      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.dashboardTitle}</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{t.dashboardSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-sim toggle */}
          <button
            onClick={handleAutoSimToggle}
            disabled={autoSimToggling}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
              autoSim
                ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            } disabled:opacity-50`}
          >
            {autoSim ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoSim ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                {t.autoSimRunning}
              </span>
            ) : t.autoSimulate}
          </button>

          <span className="text-slate-400 text-xs hidden sm:block">
            Updated {lastUpdate.toLocaleTimeString()}
          </span>
          <button onClick={fetchData}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-card">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Auto-sim Live Strip ───────────────────────────────────── */}
      {autoSim && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-ping shrink-0" />
          <p className="text-sm text-teal-700">
            <span className="font-semibold">Live Simulation Active</span> — Generating new patient readings every 30 seconds.
            Dashboard refreshes automatically.
          </p>
        </div>
      )}

      {/* ── Stat Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}         label={t.totalPatients}     value={stats?.totalPatients || 0}    color="blue" />
        <StatCard icon={AlertTriangle} label={t.highRisk}          value={stats?.highRiskCount || 0}    color="red"    pulse={!!stats?.highRiskCount} />
        <StatCard icon={Shield}        label={t.mediumRisk}        value={stats?.mediumRiskCount || 0}  color="amber" />
        <StatCard icon={Activity}      label={t.assessmentsToday}  value={stats?.alertsToday || 0}      color="teal" />
      </div>

      {/* ── High-risk Alert Banner ────────────────────────────────── */}
      {(stats?.highRiskCount || 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-red-600 animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-red-700">Autonomous Agent Actions Active</p>
            <p className="text-sm text-red-600 mt-0.5">
              {stats?.highRiskCount} high-risk patient{(stats?.highRiskCount || 0) > 1 ? 's' : ''} detected.
              CareSphere AI has autonomously alerted caregivers, generated medical summaries, and identified nearby hospitals.
            </p>
          </div>
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────────────── */}
      {stats && (
        <RiskChart
          assessments={allAssessments}
          stats={{
            highRiskCount:   stats.highRiskCount,
            mediumRiskCount: stats.mediumRiskCount,
            lowRiskCount:    stats.lowRiskCount,
          }}
        />
      )}

      {/* ── Patient Monitoring Grid ───────────────────────────────── */}
      <div>
        {/* Section Header + Filters */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-500" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">{t.patientMonitoring}</h2>
              <p className="text-slate-400 text-xs">
                Showing {filteredPatients.length} of {stats?.patientsWithReadings.length || 0} monitored patients
              </p>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Name search within dashboard */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter by name…"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 w-40"
              />
            </div>

            {/* Risk filter pills */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
              {(['all', 'high', 'medium', 'low'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setRiskFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                    riskFilter === f
                      ? f === 'all'    ? 'bg-slate-700 text-white'
                      : f === 'high'   ? 'bg-red-500 text-white'
                      : f === 'medium' ? 'bg-amber-500 text-white'
                      : 'bg-green-500 text-white'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Patient Cards */}
        {filteredPatients.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPatients.map(({ patient, latestReading, latestAssessment, adherenceRate }) => (
              <div
                key={patient.id}
                id={`patient-${patient.id}`}
                className={highlightId === patient.id ? 'ring-2 ring-brand-500 ring-offset-2 rounded-xl' : ''}
              >
                <PatientCard
                  patient={patient}
                  latestReading={latestReading}
                  latestAssessment={latestAssessment}
                  adherenceRate={adherenceRate}
                  onSimulate={handleSimulate}
                  isLoading={simLoading}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No patients match your filters</p>
            <button onClick={() => { setRiskFilter('all'); setNameFilter(''); }}
              className="mt-3 text-brand-500 text-sm hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ── Tech Stack Footer ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400">
          {[
            { dot: 'bg-teal-500',   label: 'Gemini 2.5 Flash' },
            { dot: 'bg-brand-500',  label: 'Firebase Genkit' },
            { dot: 'bg-purple-500', label: 'RAG Memory' },
            { dot: 'bg-amber-500',  label: 'Google Cloud Run' },
            { dot: 'bg-red-500',    label: 'Agentic AI' },
            { dot: 'bg-cyan-500',   label: 'Anomaly Detection' },
          ].map(({ dot, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              {label}
            </span>
          ))}
          <span className="text-slate-300">|</span>
          <span className="text-slate-400 font-medium">
            Project 2030: MyAI Future Hackathon · Track 3: Vital Signs
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-14 h-14 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function StatCard({ icon: Icon, label, value, color, pulse }: {
  icon: React.ElementType; label: string; value: number; color: string; pulse?: boolean;
}) {
  const cfg: Record<string, { bg: string; icon: string; border: string }> = {
    blue:  { bg: 'bg-brand-50',  icon: 'text-brand-500',  border: 'border-brand-100' },
    red:   { bg: 'bg-red-50',    icon: 'text-red-500',    border: 'border-red-100' },
    amber: { bg: 'bg-amber-50',  icon: 'text-amber-500',  border: 'border-amber-100' },
    teal:  { bg: 'bg-teal-50',   icon: 'text-teal-500',   border: 'border-teal-100' },
  };
  const c = cfg[color] || cfg.blue;

  return (
    <div className={`bg-white rounded-xl border ${c.border} shadow-card p-5 ${pulse ? 'ring-1 ring-red-200' : ''}`}>
      <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${c.icon} ${pulse ? 'animate-pulse' : ''}`} />
      </div>
      <p className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="text-slate-500 text-sm mt-0.5">{label}</p>
    </div>
  );
}
