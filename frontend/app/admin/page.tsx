'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, AlertTriangle, Activity, Brain, Pill, Zap, Shield,
  Play, Square, RefreshCw, ChevronRight, TrendingUp, TrendingDown,
  Clock, CheckCircle, Server, BarChart3, Loader2
} from 'lucide-react';
import { api, AdminAnalytics, BulkSimResult } from '@/lib/api';

export default function AdminPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'controls' | 'reports'>('overview');

  // Bulk sim state
  const [simCount, setSimCount] = useState(10);
  const [simScenario, setSimScenario] = useState<'normal' | 'warning' | 'critical' | 'mixed'>('mixed');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<BulkSimResult | null>(null);

  // Auto-sim state
  const [autoSimActive, setAutoSimActive] = useState(false);
  const [autoSimLoading, setAutoSimLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await api.getAdminAnalytics();
      setAnalytics(data);
      setAutoSimActive(data.system.autoSimEnabled);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const iv = setInterval(fetchAnalytics, 20000);
    return () => clearInterval(iv);
  }, [fetchAnalytics]);

  const runBulkSim = async () => {
    setSimRunning(true);
    setSimResult(null);
    try {
      const result = await api.simulateBulk(simCount, simScenario);
      setSimResult(result);
      fetchAnalytics();
    } catch {
      // ignore
    } finally {
      setSimRunning(false);
    }
  };

  const toggleAutoSim = async () => {
    setAutoSimLoading(true);
    try {
      if (autoSimActive) {
        await api.stopAutoSim();
        setAutoSimActive(false);
      } else {
        await api.startAutoSim();
        setAutoSimActive(true);
      }
    } catch {
      // ignore
    } finally {
      setAutoSimLoading(false);
    }
  };

  const triggerDemoAlert = async () => {
    try {
      await api.triggerDemoAlert();
      fetchAnalytics();
    } catch {
      // ignore
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const a = analytics!;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" />
            Admin Control Centre
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            System analytics, bulk operations & management — last updated {new Date(a.generatedAt).toLocaleTimeString()}
          </p>
        </div>
        <button onClick={fetchAnalytics} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {(['overview', 'controls', 'reports'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-5">

          {/* Primary stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Patients',     value: a.patients.total.toLocaleString(),       sub: `${a.patients.monitored} monitored`,          icon: Users,      color: 'text-brand-600',  bg: 'bg-brand-50 dark:bg-brand-900/20' },
              { label: 'High Risk Alerts',   value: a.risk.highToday,                        sub: `${a.risk.high} total high risk`,             icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
              { label: 'AI Clinical Queries',value: a.aiQueries.total.toLocaleString(),       sub: 'via RAG companion',                          icon: Brain,      color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
              { label: 'Avg Medication Adherence', value: `${a.medications.avgAdherence}%`, sub: `${a.medications.patientsTracked} patients tracked`, icon: Pill, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
            ].map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Risk distribution + Assessment stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Risk breakdown */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-500" /> Risk Distribution
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'High Risk',   count: a.risk.high,   today: a.risk.highToday,   color: 'bg-red-500',   textColor: 'text-red-600', barBg: 'bg-red-100 dark:bg-red-900/20' },
                  { label: 'Medium Risk', count: a.risk.medium, today: a.risk.mediumToday, color: 'bg-amber-400', textColor: 'text-amber-600', barBg: 'bg-amber-100 dark:bg-amber-900/20' },
                  { label: 'Low Risk',    count: a.risk.low,    today: null,               color: 'bg-green-500', textColor: 'text-green-600', barBg: 'bg-green-100 dark:bg-green-900/20' },
                ].map(({ label, count, today, color, textColor, barBg }) => {
                  const total = a.risk.high + a.risk.medium + a.risk.low || 1;
                  const pct   = Math.round((count / total) * 100);
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
                        <div className="flex items-center gap-2">
                          {today !== null && <span className="text-[10px] text-slate-400">+{today} today</span>}
                          <span className={`text-xs font-bold ${textColor}`}>{count}</span>
                        </div>
                      </div>
                      <div className={`h-2 rounded-full ${barBg} overflow-hidden`}>
                        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Assessment stats */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-500" /> Assessment Activity
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Assessments', value: a.assessments.total.toLocaleString(), icon: TrendingUp },
                  { label: 'This Week',          value: a.assessments.thisWeek,              icon: TrendingUp },
                  { label: 'Today',              value: a.assessments.today,                 icon: Clock },
                  { label: 'Yesterday',          value: a.assessments.yesterday,             icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-100 dark:border-slate-600">
                    <Icon className="w-3.5 h-3.5 text-slate-400 mb-1.5" />
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* System status */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-brand-500" /> System Status
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Backend Uptime',    value: formatUptime(a.system.uptime),     status: 'online' },
                { label: 'Auto-Sim',          value: a.system.autoSimEnabled ? 'Running' : 'Stopped', status: a.system.autoSimEnabled ? 'online' : 'offline' },
                { label: 'Caregiver Alerts',  value: `${a.alerts.today} today`,         status: 'online' },
                { label: 'AI Model',          value: 'Gemini 2.5 Flash',                status: 'online' },
              ].map(({ label, value, status }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTROLS TAB ── */}
      {tab === 'controls' && (
        <div className="space-y-5">

          {/* Auto-Sim toggle */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" /> Auto-Simulation Engine
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Continuously generates health readings for {a.system.batchSize} random patients every {a.system.intervalMs / 1000}s. Triggers caregiver alerts on medium/high risk.
                </p>
              </div>
              <button
                onClick={toggleAutoSim}
                disabled={autoSimLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  autoSimActive
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100'
                }`}
              >
                {autoSimLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : autoSimActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {autoSimActive ? 'Stop Auto-Sim' : 'Start Auto-Sim'}
              </button>
            </div>
            {autoSimActive && (
              <div className="mt-3 flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Auto-simulation is running — generating readings every {a.system.intervalMs / 1000}s for {a.system.batchSize} patients per batch
              </div>
            )}
          </div>

          {/* Bulk Simulate */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-500" /> Bulk Simulation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Run risk assessments and trigger caregiver alerts for multiple patients at once.
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Patients</label>
                <select
                  value={simCount}
                  onChange={(e) => setSimCount(parseInt(e.target.value))}
                  className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {[5, 10, 20, 30, 50].map((n) => <option key={n} value={n}>{n} patients</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Scenario</label>
                <select
                  value={simScenario}
                  onChange={(e) => setSimScenario(e.target.value as typeof simScenario)}
                  className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="mixed">Mixed (70% normal, 20% warning, 10% critical)</option>
                  <option value="normal">All Normal</option>
                  <option value="warning">All Warning</option>
                  <option value="critical">All Critical</option>
                </select>
              </div>
              <button
                onClick={runBulkSim}
                disabled={simRunning}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {simRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {simRunning ? 'Running…' : 'Run Bulk Sim'}
              </button>
            </div>

            {simResult && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                  ✅ Completed — {simResult.processed}/{simResult.requested} patients processed
                </p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'High Risk',   count: simResult.highCount,   color: 'text-red-600',   bg: 'bg-red-50 dark:bg-red-900/20' },
                    { label: 'Medium Risk', count: simResult.mediumCount, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                    { label: 'Low Risk',    count: simResult.lowCount,    color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
                  ].map(({ label, count, color, bg }) => (
                    <div key={label} className={`${bg} rounded-lg p-3 text-center`}>
                      <p className={`text-xl font-bold ${color}`}>{count}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {simResult.results.map((r) => (
                    <div key={r.patientId} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <span className="text-slate-600 dark:text-slate-300">{r.patientName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{r.scenario}</span>
                        <span className={`font-semibold ${r.riskLevel === 'high' ? 'text-red-600' : r.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>
                          {r.riskLevel} ({r.riskScore})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Demo Alert */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Demo Alert
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Trigger a critical alert for patient Ahmad — fires SMS + Email to caregiver. Use for live demos.
            </p>
            <button
              onClick={triggerDemoAlert}
              className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Zap className="w-4 h-4" /> Trigger Demo Alert
            </button>
          </div>
        </div>
      )}

      {/* ── REPORTS TAB ── */}
      {tab === 'reports' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Weekly Report Generation</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Generate AI-powered weekly health summaries for individual patients. Select a patient from the Reports page.
            </p>
            <a href="/report"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors">
              Go to Reports Page <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Audit Log</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Full timestamped log of all AI actions, risk assessments, caregiver alerts, and clinical queries.
            </p>
            <a href="/audit"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
              View Audit Log <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Quick stats for reporting */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 text-sm">Quick Summary</h3>
            <div className="space-y-2">
              {[
                { label: 'Total patients in system',          value: a.patients.total.toLocaleString(),       icon: CheckCircle },
                { label: 'Patients actively monitored',       value: a.patients.monitored,                   icon: CheckCircle },
                { label: 'Total risk assessments run',        value: a.assessments.total.toLocaleString(),   icon: CheckCircle },
                { label: 'Caregiver alerts dispatched',       value: a.alerts.total.toLocaleString(),        icon: CheckCircle },
                { label: 'AI clinical queries answered',      value: a.aiQueries.total.toLocaleString(),     icon: CheckCircle },
                { label: 'Average medication adherence',      value: `${a.medications.avgAdherence}%`,       icon: CheckCircle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Icon className="w-3.5 h-3.5 text-green-500" />
                    {label}
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
