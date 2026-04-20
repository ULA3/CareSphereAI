'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Heart, Activity, Wind, Moon, Zap, Thermometer,
  User, MapPin, Phone, Pill, ChevronLeft, Send,
  AlertTriangle, CheckCircle2, MessageCircle, RefreshCw,
  Stethoscope, FileText, Bot, Clock, Hospital,
  BellRing, Siren, Brain,
} from 'lucide-react';
import { format } from 'date-fns';
import RiskBadge from '@/components/ui/RiskBadge';
import { api, Patient, HealthReading, RiskAssessment, CompanionResponse } from '@/lib/api';

/* ─── helpers ───────────────────────────────────────────────── */
const isAbnormalHR   = (v: number) => v > 100 || v < 55;
const isAbnormalBP   = (v: number) => v > 160;
const isAbnormalO2   = (v: number) => v < 95;
const isAbnormalSleep= (v: number) => v < 5;
const isAbnormalTemp = (v: number) => v > 37.8;

/* ─── VitalCard ─────────────────────────────────────────────── */
function VitalCard({ icon: Icon, label, value, unit, alert }: {
  icon: React.ElementType; label: string; value: string; unit: string; alert?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col gap-1.5 border ${
      alert
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
    }`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${alert ? 'text-red-500' : 'text-brand-500'}`} />
        <span className={`text-xs font-medium ${alert ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
        {alert && <AlertTriangle className="w-3.5 h-3.5 text-red-400 ml-auto" />}
      </div>
      <p className={`text-2xl font-bold leading-none ${alert ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}
        <span className={`text-xs font-normal ml-1 ${alert ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>{unit}</span>
      </p>
    </div>
  );
}

/* ─── ConditionPill ─────────────────────────────────────────── */
function ConditionPill({ children, color = 'teal' }: { children: React.ReactNode; color?: 'teal' | 'slate' | 'purple' }) {
  const cls = {
    teal:   'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800/50',
    slate:  'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
  }[color];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {children}
    </span>
  );
}

/* ─── Chat message types ────────────────────────────────────── */
type ChatMsg = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  sentiment?: string;
  suggestions?: string[];
  medReminders?: string[];
  flagged?: boolean;
  timestamp: Date;
};

/* ─── Agent action log ──────────────────────────────────────── */
type AgentAction = {
  id: string;
  icon: React.ElementType;
  label: string;
  detail: string;
  color: string;
  delay: number;
};

type SimScenario = 'normal' | 'warning' | 'critical';

/* ─── main page ─────────────────────────────────────────────── */
export default function PatientProfilePage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = Array.isArray(params.id) ? params.id[0] : params.id as string;

  const [patient,     setPatient]     = useState<Patient | null>(null);
  const [readings,    setReadings]    = useState<HealthReading[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  /* chat */
  const [chatInput,   setChatInput]   = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const chatInputRef= useRef<HTMLInputElement>(null);

  /* simulate */
  const [simLoading,    setSimLoading]    = useState(false);
  const [simResult,     setSimResult]     = useState<{ scenario: string; assessment: RiskAssessment; anomalies: string[] } | null>(null);
  const [agentActions,  setAgentActions]  = useState<AgentAction[]>([]);
  const [visibleActions,setVisibleActions]= useState<number>(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.getPatient(id), api.getReadings(id, 20), api.getAssessments(id, 10)])
      .then(([p, r, a]) => { setPatient(p); setReadings(r); setAssessments(a); })
      .catch((e)  => setError(e?.message || 'Failed to load patient data'))
      .finally(() => setLoading(false));
  }, [id]);

  /* scroll chat to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  /* animate agent action log */
  useEffect(() => {
    if (agentActions.length === 0) { setVisibleActions(0); return; }
    setVisibleActions(0);
    agentActions.forEach((_, i) => {
      setTimeout(() => setVisibleActions(i + 1), 600 * (i + 1));
    });
  }, [agentActions]);

  /* ── Loading ───────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading patient profile…</p>
    </div>
  );

  /* ── Error ─────────────────────────────────────────────────── */
  if (error || !patient) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-8 max-w-md w-full text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-1">Patient Not Found</h2>
        <p className="text-sm text-red-500 dark:text-red-400 mb-4">{error || 'This patient record does not exist.'}</p>
        <button onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    </div>
  );

  const latestReading    = readings[0] ?? null;
  const latestAssessment = assessments[0] ?? null;
  const historyRows      = readings.slice(0, 10);
  const firstName        = patient.name.split(' ')[0];

  /* ── Chat handler ──────────────────────────────────────────── */
  async function handleChat(overrideMsg?: string) {
    const msg = (overrideMsg ?? chatInput).trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() };
    setChatHistory((h) => [...h, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res: CompanionResponse = await api.chat(id, msg);
      const aiMsg: ChatMsg = {
        id: Date.now().toString() + '-ai',
        role: 'ai',
        content: res.response,
        sentiment: res.sentiment,
        suggestions: res.followUpSuggestions,
        medReminders: res.medicationReminders,
        flagged: res.flaggedForCaregiver,
        timestamp: new Date(),
      };
      setChatHistory((h) => [...h, aiMsg]);
    } catch {
      setChatHistory((h) => [...h, {
        id: Date.now().toString() + '-err',
        role: 'ai',
        content: 'Sorry, the AI companion is temporarily unavailable.',
        timestamp: new Date(),
      }]);
    } finally {
      setChatLoading(false);
    }
  }

  /* ── Simulate handler ──────────────────────────────────────── */
  async function handleSimulate(scenario: SimScenario) {
    setSimLoading(true);
    setSimResult(null);
    setAgentActions([]);
    try {
      const res = await api.simulate(id, scenario) as { scenario: string; assessment: RiskAssessment; anomalies: string[] };
      setSimResult(res);
      await Promise.all([api.getReadings(id, 20), api.getAssessments(id, 10)])
        .then(([r, a]) => { setReadings(r); setAssessments(a); });

      /* Build agent action log */
      if (scenario === 'critical' || res.assessment.riskLevel === 'high') {
        const actions: AgentAction[] = [
          { id: '1', icon: Brain,    label: 'Gemini 2.5 Flash — Risk Assessment',   detail: `Score ${res.assessment.riskScore}/100 — HIGH risk detected`, color: 'text-brand-500', delay: 0 },
          { id: '2', icon: FileText, label: 'Medical Summary Generated',             detail: `${res.assessment.reasons.slice(0,2).join('; ')}`,             color: 'text-purple-500', delay: 1 },
          { id: '3', icon: BellRing, label: `Caregiver Alerted — ${patient?.caregiver.name ?? 'Caregiver'}`, detail: `${patient?.caregiver.relationship ?? ''} · ${patient?.caregiver.phone ?? ''}`, color: 'text-amber-500', delay: 2 },
          { id: '4', icon: Hospital, label: 'Nearest Hospital Identified',           detail: `Hospital Kerajaan — ${patient?.location.city ?? 'Nearby'}`,   color: 'text-teal-500', delay: 3 },
          { id: '5', icon: Siren,    label: 'Emergency Protocol Activated',          detail: 'Monitoring frequency increased to every 60 seconds',          color: 'text-red-500', delay: 4 },
        ];
        setAgentActions(actions);
      } else if (scenario === 'warning' || res.assessment.riskLevel === 'medium') {
        const actions: AgentAction[] = [
          { id: '1', icon: Brain,    label: 'Gemini 2.5 Flash — Risk Assessment',   detail: `Score ${res.assessment.riskScore}/100 — MEDIUM risk`, color: 'text-brand-500', delay: 0 },
          { id: '2', icon: FileText, label: 'Health Advisory Generated',             detail: res.assessment.recommendations[0] || 'Monitoring closely', color: 'text-purple-500', delay: 1 },
          { id: '3', icon: BellRing, label: 'Caregiver Notification Queued',         detail: 'Will escalate if vitals worsen in next 2 hours',        color: 'text-amber-500', delay: 2 },
        ];
        setAgentActions(actions);
      } else {
        const actions: AgentAction[] = [
          { id: '1', icon: Brain,       label: 'Gemini 2.5 Flash — Risk Assessment', detail: `Score ${res.assessment.riskScore}/100 — LOW risk`, color: 'text-brand-500', delay: 0 },
          { id: '2', icon: CheckCircle2,label: 'All Vitals Within Normal Range',      detail: 'No agent actions required',                        color: 'text-green-500', delay: 1 },
        ];
        setAgentActions(actions);
      }
    } catch {
      // silent
    } finally {
      setSimLoading(false);
    }
  }

  const simColors: Record<string, string> = {
    normal:   'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-800 dark:text-green-300',
    warning:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300',
    critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300',
  };

  /* ════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 animate-fade-in pb-12">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors font-medium">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">{patient.name}</h1>
          {latestAssessment && <RiskBadge level={latestAssessment.riskLevel} score={latestAssessment.riskScore} size="lg" />}
        </div>
      </div>

      {/* ── WHO IS THIS PATIENT? ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-brand-50 to-teal-50 dark:from-brand-900/20 dark:to-teal-900/20 border border-brand-100 dark:border-brand-800/30 rounded-2xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <Stethoscope className="w-5 h-5 text-brand-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider">Monitored by CareSphere AI</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This profile is actively monitored by healthcare providers & family caregivers. Alerts are sent automatically when vitals are abnormal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800/50 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> Live Monitoring
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{readings.length} readings recorded</span>
        </div>
      </div>

      {/* ── TOP ROW: Profile + Vitals ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">

        {/* PROFILE CARD */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-400 flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-sm">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{patient.name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5" /> {patient.age} yrs · {patient.gender}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-brand-400" /> {patient.location.city}, {patient.location.state}
              </p>
            </div>
          </div>

          {patient.conditions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5" /> Medical Conditions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {patient.conditions.map((c) => <ConditionPill key={c} color="teal">{c}</ConditionPill>)}
              </div>
            </div>
          )}

          {patient.medications.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5" /> Current Medications
              </p>
              <div className="flex flex-wrap gap-1.5">
                {patient.medications.map((m) => <ConditionPill key={m} color="purple">{m}</ConditionPill>)}
              </div>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-100 dark:border-slate-600">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Emergency Contact
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{patient.caregiver.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{patient.caregiver.relationship}</p>
            <a href={`tel:${patient.caregiver.phone}`}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 font-medium transition-colors">
              <Phone className="w-3.5 h-3.5" /> {patient.caregiver.phone}
            </a>
          </div>
        </div>

        {/* VITALS + RISK */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-500" /> Latest Vitals
              {latestReading && (
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-normal">
                  {format(new Date(latestReading.timestamp), 'MMM d, yyyy HH:mm')}
                </span>
              )}
            </h3>
            {latestReading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <VitalCard icon={Heart}       label="Heart Rate"      value={`${latestReading.heartRate}`}                                               unit="bpm"  alert={isAbnormalHR(latestReading.heartRate)} />
                <VitalCard icon={Activity}    label="Blood Pressure"  value={`${latestReading.bloodPressure.systolic}/${latestReading.bloodPressure.diastolic}`} unit="mmHg" alert={isAbnormalBP(latestReading.bloodPressure.systolic)} />
                <VitalCard icon={Wind}        label="SpO₂"            value={`${latestReading.oxygenSaturation.toFixed(1)}`}                             unit="%"    alert={isAbnormalO2(latestReading.oxygenSaturation)} />
                <VitalCard icon={Moon}        label="Sleep"           value={`${latestReading.sleepHours.toFixed(1)}`}                                   unit="hrs"  alert={isAbnormalSleep(latestReading.sleepHours)} />
                <VitalCard icon={Zap}         label="Movement"        value={`${latestReading.movementScore.toFixed(0)}`}                                unit="/100" alert={false} />
                <VitalCard icon={Thermometer} label="Temperature"     value={`${latestReading.temperature.toFixed(1)}`}                                  unit="°C"   alert={isAbnormalTemp(latestReading.temperature)} />
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm bg-slate-50 dark:bg-slate-700/50 rounded-xl">No readings available</div>
            )}
          </div>

          {latestAssessment && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-500" /> Latest Risk Assessment
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-normal">
                  {format(new Date(latestAssessment.timestamp), 'MMM d, yyyy HH:mm')}
                </span>
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <RiskBadge level={latestAssessment.riskLevel} score={latestAssessment.riskScore} size="lg" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>Risk Score</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{latestAssessment.riskScore}/100</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${latestAssessment.riskLevel === 'high' ? 'bg-red-500' : latestAssessment.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-green-500'}`}
                      style={{ width: `${latestAssessment.riskScore}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {latestAssessment.reasons.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Risk Factors
                    </p>
                    <ul className="space-y-1">
                      {latestAssessment.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                          <span className="text-red-400 mt-0.5 shrink-0">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {latestAssessment.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Recommendations
                    </p>
                    <ul className="space-y-1">
                      {latestAssessment.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5 shrink-0">✓</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {latestAssessment.geminiReasoning && (
                <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1.5">
                    ✦ Gemini 2.5 Flash AI Reasoning
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{latestAssessment.geminiReasoning}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SCENARIO SIMULATOR + AGENT ACTION LOG ─────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card p-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
          <Bot className="w-4 h-4 text-brand-500" /> Autonomous AI Agent — Scenario Simulator
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
          Trigger a health scenario and watch CareSphere AI autonomously assess, alert, and act — no human input needed.
        </p>

        <div className="flex gap-3 flex-wrap mb-5">
          {(['normal', 'warning', 'critical'] as SimScenario[]).map((scenario) => {
            const styles = {
              normal:   'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 hover:bg-green-100',
              warning:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 hover:bg-amber-100',
              critical: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 hover:bg-red-100',
            };
            const icons = {
              normal:   <CheckCircle2 className="w-4 h-4" />,
              warning:  <AlertTriangle className="w-4 h-4" />,
              critical: <Siren className="w-4 h-4" />,
            };
            return (
              <button key={scenario} onClick={() => handleSimulate(scenario)} disabled={simLoading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles[scenario]}`}>
                {simLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : icons[scenario]}
                {scenario.charAt(0).toUpperCase() + scenario.slice(1)} Scenario
              </button>
            );
          })}
        </div>

        {/* Agent Action Log */}
        {agentActions.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-700/50 px-4 py-2.5 border-b border-slate-200 dark:border-slate-600 flex items-center gap-2">
              <Bot className="w-4 h-4 text-brand-500" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Agent Action Log</p>
              <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {agentActions.slice(0, visibleActions).map((action) => {
                const Icon = action.icon;
                return (
                  <div key={action.id} className="flex items-start gap-3 px-4 py-3 animate-slide-up">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className={`w-3.5 h-3.5 ${action.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{action.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{action.detail}</p>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  </div>
                );
              })}
              {visibleActions < agentActions.length && (
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 dark:text-slate-500">Agent processing…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sim result summary */}
        {simResult && (
          <div className={`mt-3 border rounded-xl p-3 text-xs font-medium ${simColors[simResult.scenario] ?? 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300'}`}>
            ✦ Scenario complete — Risk Level: {simResult.assessment.riskLevel.toUpperCase()} · Score: {simResult.assessment.riskScore}/100
            {simResult.anomalies.length > 0 && ` · ${simResult.anomalies.length} anomaly detected`}
          </div>
        )}
      </div>

      {/* ── AI COMPANION CHAT ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-gradient-to-r from-brand-50 to-teal-50 dark:from-brand-900/20 dark:to-teal-900/20">
          <MessageCircle className="w-4 h-4 text-brand-500" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">AI Companion Chat — {firstName}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Powered by Gemini 2.5 Flash · Context-aware with {firstName}'s real vitals & medical history</p>
          </div>
        </div>

        {/* Chat messages */}
        <div className="h-72 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
          {chatHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <Bot className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400 dark:text-slate-500">Start a conversation with {firstName}'s AI companion</p>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {[`I feel tired today`, `How is my blood pressure?`, `Remind me my medications`].map((s) => (
                  <button key={s} onClick={() => handleChat(s)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-brand-200 dark:border-slate-600 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-slate-600 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chatHistory.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'ai' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-teal-400 flex items-center justify-center text-white shrink-0 mr-2 mt-1">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'chat-bubble-user px-4 py-2.5' : 'chat-bubble-ai px-4 py-3'}`}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                {msg.role === 'ai' && msg.medReminders && msg.medReminders.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-blue-100 dark:border-slate-600">
                    {msg.medReminders.map((r, i) => (
                      <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Pill className="w-3 h-3" /> {r}
                      </p>
                    ))}
                  </div>
                )}
                {msg.role === 'ai' && msg.flagged && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Caregiver has been notified
                  </p>
                )}
                {msg.role === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.suggestions.map((s, i) => (
                      <button key={i} onClick={() => handleChat(s)}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-brand-200 dark:border-slate-600 text-brand-700 dark:text-brand-300 hover:bg-brand-50 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-right mt-1 opacity-50">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-teal-400 flex items-center justify-center text-white shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="chat-bubble-ai px-4 py-3">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleChat()}
            placeholder={`Message AI companion for ${firstName}…`}
            className="flex-1 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
            disabled={chatLoading}
          />
          <button onClick={() => handleChat()} disabled={chatLoading || !chatInput.trim()}
            className="px-4 py-2.5 bg-brand-500 text-white rounded-xl font-medium text-sm hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0">
            {chatLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── VITALS HISTORY TABLE ─────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Vitals History</h3>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">Last {historyRows.length} readings</span>
        </div>
        {historyRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                  {['Time', 'Heart Rate', 'Blood Pressure', 'SpO₂', 'Sleep', 'Movement', 'Temp'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyRows.map((r, idx) => (
                  <tr key={r.id} className={`border-b border-slate-50 dark:border-slate-700/50 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-700/20'}`}>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{format(new Date(r.timestamp), 'MMM d, HH:mm')}</td>
                    <td className={`px-4 py-3 font-semibold ${isAbnormalHR(r.heartRate)           ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{r.heartRate} <span className="font-normal text-slate-400">bpm</span></td>
                    <td className={`px-4 py-3 font-semibold ${isAbnormalBP(r.bloodPressure.systolic) ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{r.bloodPressure.systolic}/{r.bloodPressure.diastolic} <span className="font-normal text-slate-400">mmHg</span></td>
                    <td className={`px-4 py-3 font-semibold ${isAbnormalO2(r.oxygenSaturation)    ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{r.oxygenSaturation.toFixed(1)}<span className="font-normal text-slate-400">%</span></td>
                    <td className={`px-4 py-3 font-semibold ${isAbnormalSleep(r.sleepHours)       ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{r.sleepHours.toFixed(1)}<span className="font-normal text-slate-400">h</span></td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{r.movementScore.toFixed(0)}<span className="font-normal text-slate-400">/100</span></td>
                    <td className={`px-4 py-3 font-semibold ${isAbnormalTemp(r.temperature)       ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{r.temperature.toFixed(1)}<span className="font-normal text-slate-400">°C</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">No readings available</div>
        )}
      </div>
    </div>
  );
}
