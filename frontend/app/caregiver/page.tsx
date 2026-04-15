'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Heart, AlertTriangle, Phone, Mail, Activity, Pill, RefreshCw } from 'lucide-react';
import { api, DashboardStats } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CaregiverPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const riskColor = (level: string) => ({
    high: 'text-red-400 bg-red-500/10 border-red-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  }[level] || 'text-gray-400 bg-gray-800 border-gray-700');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const highRiskPatients = stats?.patientsWithReadings.filter(
    (p) => p.latestAssessment?.riskLevel === 'high'
  ) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.caregiver}</h1>
          <p className="text-gray-400 mt-1 text-sm">Family & caregiver overview — all patients at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-gray-500 text-xs">Updated {lastUpdate.toLocaleTimeString()}</p>
          <button onClick={fetchData}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Urgent Alerts */}
      {highRiskPatients.length > 0 && (
        <div className="glass-card p-5 border-red-500/40 bg-red-500/5 glow-red">
          <h2 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            URGENT — Immediate Attention Required
          </h2>
          <div className="space-y-2">
            {highRiskPatients.map(({ patient, latestAssessment }) => (
              <div key={patient.id} className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-red-200">{patient.name}</p>
                    <p className="text-xs text-red-400/80">{patient.age} yrs · {patient.location.city}</p>
                  </div>
                  <span className="text-xs font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30">
                    Score: {latestAssessment?.riskScore}/100
                  </span>
                </div>
                {latestAssessment && (
                  <p className="text-xs text-red-300/80 mt-2 line-clamp-2">{latestAssessment.geminiReasoning}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <a href={`tel:${patient.caregiver.phone}`}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    <Phone className="w-3 h-3" /> {patient.caregiver.phone}
                  </a>
                  <a href={`mailto:${patient.caregiver.email}`}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    <Mail className="w-3 h-3" /> {patient.caregiver.email}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <Users className="w-5 h-5 text-blue-400 mb-2" />
          <p className="text-3xl font-bold text-white">{stats?.totalPatients || 0}</p>
          <p className="text-gray-400 text-sm mt-1">{t.totalPatients}</p>
        </div>
        <div className={`glass-card p-5 ${(stats?.highRiskCount || 0) > 0 ? 'glow-red' : ''}`}>
          <AlertTriangle className={`w-5 h-5 mb-2 ${(stats?.highRiskCount || 0) > 0 ? 'text-red-400 animate-pulse' : 'text-gray-600'}`} />
          <p className="text-3xl font-bold text-white">{stats?.highRiskCount || 0}</p>
          <p className="text-gray-400 text-sm mt-1">{t.highRisk}</p>
        </div>
        <div className="glass-card p-5">
          <Activity className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-3xl font-bold text-white">{stats?.mediumRiskCount || 0}</p>
          <p className="text-gray-400 text-sm mt-1">{t.mediumRisk}</p>
        </div>
        <div className="glass-card p-5">
          <Heart className="w-5 h-5 text-emerald-400 mb-2" />
          <p className="text-3xl font-bold text-white">{stats?.alertsToday || 0}</p>
          <p className="text-gray-400 text-sm mt-1">{t.assessmentsToday}</p>
        </div>
      </div>

      {/* All Patients Detail */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          All Patients Under Care
        </h2>
        <div className="space-y-4">
          {stats?.patientsWithReadings.map(({ patient, latestReading, latestAssessment, adherenceRate }) => {
            const riskLevel = latestAssessment?.riskLevel || 'low';
            return (
              <div key={patient.id} className={`glass-card p-5 transition-all hover:scale-[1.002] border ${riskColor(riskLevel)}`}>
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Patient Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-bold text-white text-lg">{patient.name}</h3>
                      {latestAssessment && (
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${riskColor(riskLevel)}`}>
                          {riskLevel} risk · {latestAssessment.riskScore}/100
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">{patient.age} years · {patient.gender} · {patient.location.city}, {patient.location.state}</p>
                    <p className="text-gray-500 text-xs mt-1">{patient.conditions.join(' · ')}</p>
                  </div>

                  {/* Caregiver Contact */}
                  <div className="text-right">
                    <p className="text-xs text-gray-400 font-semibold">{patient.caregiver.name}</p>
                    <p className="text-xs text-gray-500">{patient.caregiver.relationship}</p>
                    <a href={`tel:${patient.caregiver.phone}`}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 justify-end mt-1 transition-colors">
                      <Phone className="w-3 h-3" /> {patient.caregiver.phone}
                    </a>
                  </div>
                </div>

                {/* Vitals Row */}
                {latestReading && (
                  <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
                    {[
                      { label: 'HR', value: `${latestReading.heartRate}bpm`, alert: latestReading.heartRate > 100 || latestReading.heartRate < 50 },
                      { label: 'BP', value: `${latestReading.bloodPressure.systolic}/${latestReading.bloodPressure.diastolic}`, alert: latestReading.bloodPressure.systolic > 160 },
                      { label: 'O₂', value: `${latestReading.oxygenSaturation.toFixed(1)}%`, alert: latestReading.oxygenSaturation < 95 },
                      { label: 'Sleep', value: `${latestReading.sleepHours.toFixed(1)}h`, alert: latestReading.sleepHours < 5 },
                      { label: 'Move', value: `${latestReading.movementScore.toFixed(0)}/100`, alert: latestReading.movementScore < 30 },
                      { label: 'Temp', value: `${latestReading.temperature.toFixed(1)}°C`, alert: latestReading.temperature > 37.8 },
                    ].map(({ label, value, alert }) => (
                      <div key={label} className={`text-center p-2 rounded-lg ${alert ? 'bg-red-500/10 border border-red-500/20' : 'bg-gray-800/50'}`}>
                        <p className={`text-sm font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Medication Adherence + AI Reasoning */}
                <div className="mt-4 flex gap-4 flex-wrap">
                  {adherenceRate !== undefined && (
                    <div className="flex items-center gap-2">
                      <Pill className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-400">{t.adherenceRate}:</span>
                      <span className={`text-xs font-bold ${adherenceRate >= 80 ? 'text-emerald-400' : adherenceRate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                        {adherenceRate}%
                      </span>
                    </div>
                  )}
                  {latestAssessment && (
                    <p className="text-xs text-gray-500 italic flex-1 line-clamp-2">
                      {latestAssessment.geminiReasoning}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
