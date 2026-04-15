'use client';

import { useState, useEffect } from 'react';
import { FileText, RefreshCw, ChevronDown, TrendingUp, TrendingDown, Minus, CheckCircle, AlertCircle, Pill, Calendar, Printer } from 'lucide-react';
import { api, WeeklyReport, Patient } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const STATUS_COLORS: Record<string, string> = {
  Stable: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  Improving: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  Deteriorating: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  'Requires Attention': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
};

const STATUS_ICON: Record<string, React.ElementType> = {
  Stable: Minus,
  Improving: TrendingDown,
  Deteriorating: TrendingUp,
  Critical: AlertCircle,
  'Requires Attention': AlertCircle,
};

export default function ReportPage() {
  const { t } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    api.getPatients().then((ps) => {
      setPatients(ps);
      if (ps.length > 0) setSelectedPatientId(ps[0].id);
    });
  }, []);

  const handleGenerate = async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    setReport(null);
    try {
      const data = await api.getWeeklyReport(selectedPatientId);
      setReport(data);
      setGenerated(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = report ? (STATUS_ICON[report.overallStatus] || Minus) : Minus;
  const statusColor = report ? (STATUS_COLORS[report.overallStatus] || 'text-gray-400') : '';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.weeklyReport}</h1>
          <p className="text-gray-400 mt-1 text-sm">AI-generated comprehensive weekly health summary</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedPatientId}
              onChange={(e) => { setSelectedPatientId(e.target.value); setReport(null); setGenerated(false); }}
              className="appearance-none bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-emerald-500"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {report && !loading && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Export
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {loading ? 'Generating...' : `${t.generate} Report`}
          </button>
        </div>
      </div>

      {/* Prompt to generate */}
      {!generated && !loading && (
        <div className="glass-card p-12 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-400 mb-2">Generate Weekly Health Report</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            CareSphere AI will analyse the past 7 days of health data, assess vital sign trends,
            medication adherence, and risk events to produce a comprehensive clinical report.
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
          >
            Generate Report for {patients.find((p) => p.id === selectedPatientId)?.name || 'Patient'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Gemini AI is analysing 7 days of health data...</p>
          <p className="text-gray-600 text-xs mt-2">This may take a few seconds</p>
        </div>
      )}

      {/* Report */}
      {report && !loading && (
        <div className="space-y-4">
          {/* Report Header Card */}
          <div className="glass-card p-6 border-emerald-500/20">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{report.patientName}</h2>
                <p className="text-gray-400 text-sm mt-1">{report.reportDate}</p>
                <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Period: {report.periodCovered}
                </p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold ${statusColor}`}>
                <StatusIcon className="w-4 h-4" />
                {report.overallStatus}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <p className="text-xs text-emerald-400 font-semibold mb-1">Executive Summary</p>
              <p className="text-sm text-gray-300 leading-relaxed">{report.executiveSummary}</p>
            </div>
          </div>

          {/* Vital Signs Summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Vital Signs Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(report.vitalSignsSummary).map(([key, value]) => (
                <div key={key} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <p className="text-xs text-gray-500 capitalize mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-sm text-gray-300">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Key Findings */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Key Findings
              </h3>
              <ul className="space-y-2">
                {report.keyFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-emerald-400 shrink-0 mt-0.5">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                Recommendations
              </h3>
              <ul className="space-y-2">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-blue-400 shrink-0 mt-0.5">→</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Medication Adherence */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4 text-purple-400" />
              Medication Adherence
            </h3>
            <p className="text-sm text-gray-300">{report.medicationAdherence}</p>
          </div>

          {/* Risk Trend */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Risk Trend Analysis
            </h3>
            <p className="text-sm text-gray-300">{report.riskTrend}</p>
          </div>

          {/* Caregiver Actions */}
          <div className="glass-card p-5 border-amber-500/20 bg-amber-500/5">
            <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Action Items for Caregiver
            </h3>
            <ul className="space-y-2">
              {report.caregiverActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-amber-400 shrink-0 font-bold mt-0.5">{i + 1}.</span>
                  {action}
                </li>
              ))}
            </ul>
          </div>

          {/* Next Review */}
          <div className="glass-card p-4 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Next Weekly Review</p>
              <p className="text-sm font-semibold text-white">{report.nextReviewDate}</p>
            </div>
            <div className="ml-auto">
              <button onClick={handleGenerate}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
