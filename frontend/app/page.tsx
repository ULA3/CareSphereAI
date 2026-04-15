'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, Users, Shield, RefreshCw, Zap, Play, Square } from 'lucide-react';
import { api, DashboardStats, RiskAssessment } from '@/lib/api';
import PatientCard from '@/components/dashboard/PatientCard';
import RiskChart from '@/components/dashboard/RiskChart';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Dashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allAssessments, setAllAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [autoSim, setAutoSim] = useState(false);
  const [autoSimToggling, setAutoSimToggling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'warning' | 'error' } | null>(null);

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
      const assessment = result.assessment;
      const type = assessment.riskLevel === 'high' ? 'error' : assessment.riskLevel === 'medium' ? 'warning' : 'success';

      let msg = `${scenario.toUpperCase()} → ${assessment.riskLevel.toUpperCase()} risk (score: ${assessment.riskScore})`;
      if (result.anomalies && result.anomalies.length > 0) {
        msg += ` ⚠ Baseline anomaly detected!`;
      }
      if (assessment.riskLevel !== 'low') msg += ' Agent actions triggered!';

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
        setNotification({ msg: 'Auto-simulation started! New readings every 30s for all patients.', type: 'success' });
      }
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      setNotification({ msg: `Auto-sim error: ${err}`, type: 'error' });
    } finally {
      setAutoSimToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Notification Banner */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-xl border shadow-lg animate-slide-up ${
          notification.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-200' :
          notification.type === 'warning' ? 'bg-amber-900/90 border-amber-500/50 text-amber-200' :
          'bg-emerald-900/90 border-emerald-500/50 text-emerald-200'
        }`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm">{notification.msg}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.dashboardTitle}</h1>
          <p className="text-gray-400 mt-1 text-sm">{t.dashboardSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-Simulate Toggle */}
          <button
            onClick={handleAutoSimToggle}
            disabled={autoSimToggling}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 ${
              autoSim
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
            } disabled:opacity-50`}
          >
            {autoSim ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoSim ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t.autoSimRunning}
              </span>
            ) : t.autoSimulate}
          </button>

          <p className="text-gray-500 text-xs">Updated {lastUpdate.toLocaleTimeString()}</p>
          <button onClick={fetchData}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auto-sim live indicator */}
      {autoSim && (
        <div className="glass-card p-3 border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <p className="text-sm text-emerald-300">
            <span className="font-semibold">Live Auto-Simulation Active</span> — Generating new patient readings every 30 seconds. Dashboard refreshes every 15s.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t.totalPatients} value={stats?.totalPatients || 0} color="blue" />
        <StatCard icon={AlertTriangle} label={t.highRisk} value={stats?.highRiskCount || 0} color="red" pulse={!!stats?.highRiskCount} />
        <StatCard icon={Shield} label={t.mediumRisk} value={stats?.mediumRiskCount || 0} color="yellow" />
        <StatCard icon={Activity} label={t.assessmentsToday} value={stats?.alertsToday || 0} color="green" />
      </div>

      {/* AI Action Banner */}
      {(stats?.highRiskCount || 0) > 0 && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/5 glow-red flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-red-400 animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-red-300">Autonomous Agent Actions Active</p>
            <p className="text-sm text-red-400/80">
              {stats?.highRiskCount} high-risk patient(s) detected. CareSphere AI has autonomously alerted caregivers,
              generated medical summaries, and identified nearby hospitals.
            </p>
          </div>
        </div>
      )}

      {/* Risk Analytics Charts */}
      {stats && (
        <RiskChart assessments={allAssessments} stats={{
          highRiskCount: stats.highRiskCount,
          mediumRiskCount: stats.mediumRiskCount,
          lowRiskCount: stats.lowRiskCount,
        }} />
      )}

      {/* Patient Cards */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          {t.patientMonitoring}
          <span className="text-sm font-normal text-gray-400 ml-2">
            Click scenarios to trigger AI risk assessment · SOS triggers full emergency agent
          </span>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {stats?.patientsWithReadings.map(({ patient, latestReading, latestAssessment, adherenceRate }) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              latestReading={latestReading}
              latestAssessment={latestAssessment}
              adherenceRate={adherenceRate}
              onSimulate={handleSimulate}
              isLoading={simLoading}
            />
          ))}
        </div>
      </div>

      {/* Tech Stack Footer */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Gemini 2.5 Flash</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Firebase Genkit</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> RAG Memory</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Google Cloud Run</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Agentic AI</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Baseline Anomaly Detection</span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">Project 2030: MyAI Future Hackathon · Track 3: Vital Signs</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, pulse }: {
  icon: React.ElementType; label: string; value: number; color: string; pulse?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    yellow: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div className={`glass-card p-5 ${pulse ? 'glow-red' : ''}`}>
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className={`w-5 h-5 ${pulse ? 'animate-pulse' : ''}`} />
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  );
}
