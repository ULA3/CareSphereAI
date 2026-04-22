'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send, Brain, ChevronRight, User, Stethoscope,
  FileText, TrendingUp, Pill, AlertTriangle, Loader2, Sparkles
} from 'lucide-react';
import { api, Patient, CompanionResponse } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  sentiment?: string;
  flagged?: boolean;
}

const SUGGESTED_QUERIES = [
  { icon: TrendingUp,  label: 'Vital trend summary',       query: 'Give me a summary of this patient\'s vital signs trend over the past week.' },
  { icon: Pill,        label: 'Medication review',          query: 'Review this patient\'s current medications and flag any concerns.' },
  { icon: AlertTriangle, label: 'Risk factors',             query: 'What are the top risk factors I should be monitoring for this patient?' },
  { icon: FileText,    label: 'Clinical summary',           query: 'Generate a concise clinical summary of this patient\'s current health status.' },
  { icon: Stethoscope, label: 'Condition assessment',       query: 'Based on the latest readings, how well-controlled are this patient\'s chronic conditions?' },
  { icon: TrendingUp,  label: 'Deterioration signs',        query: 'Are there any early signs of health deterioration I should be concerned about?' },
];

export default function ClinicalAssistantPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getPatients().then((ps) => {
      setPatients(ps);
      if (ps.length > 0) setSelectedPatient(ps[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      api.getChatHistory(selectedPatient).then((history) => {
        const msgs: Message[] = history.map((h) => ({
          id: h.id,
          role: h.role === 'user' ? 'user' : 'ai',
          content: h.content,
          timestamp: new Date(h.timestamp),
        }));
        setMessages(msgs);
      }).catch(() => setMessages([]));
    }
  }, [selectedPatient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msgText = (text || input).trim();
    if (!msgText || !selectedPatient || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: msgText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result: CompanionResponse = await api.chat(selectedPatient, msgText, 'general', 'en');
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'ai',
        content: result.response,
        timestamp: new Date(),
        sentiment: result.sentiment,
        flagged: result.flaggedForCaregiver,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setInput(msgText);
      setMessages((prev) => [...prev, {
        id: `e-${Date.now()}`,
        role: 'ai',
        content: 'Unable to connect to the AI backend. Please check your connection and try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const currentPatient = patients.find((p) => p.id === selectedPatient);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 animate-fade-in">

      {/* ── Left Panel ──────────────────────────────────────────────── */}
      <div className="w-72 flex flex-col gap-4 shrink-0">

        {/* Patient selector */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-brand-500" />
            AI Clinical Assistant
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Ask clinical questions about any patient — powered by Gemini 2.5 Flash + RAG memory.
          </p>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">Select Patient</label>
          <select
            value={selectedPatient}
            onChange={(e) => { setSelectedPatient(e.target.value); setMessages([]); }}
            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {currentPatient && (
            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{currentPatient.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{currentPatient.age}y · {currentPatient.gender} · {currentPatient.location.city}</p>
                </div>
              </div>
              <div className="pt-1 space-y-0.5">
                {currentPatient.conditions.map((c) => (
                  <span key={c} className="inline-block text-[10px] bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800 rounded-full px-2 py-0.5 mr-1 mb-0.5">{c}</span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                {currentPatient.medications.length} medications on record
              </p>
            </div>
          )}
        </div>

        {/* Suggested queries */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card p-4 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Quick Clinical Queries</p>
          <div className="space-y-1">
            {SUGGESTED_QUERIES.map(({ icon: Icon, label, query }) => (
              <button
                key={label}
                onClick={() => sendMessage(query)}
                disabled={loading || !selectedPatient}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-700 dark:hover:text-brand-400 text-slate-600 dark:text-slate-300 disabled:opacity-40 group border border-transparent hover:border-brand-200 dark:hover:border-brand-800"
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-brand-500" />
                <span className="flex-1 truncate">{label}</span>
                <ChevronRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 text-brand-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chat Area ───────────────────────────────────────────────── */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-md">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">AI Clinical Assistant</p>
            <p className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-blink" />
              Gemini 2.5 Flash · RAG Health Memory · Real Patient Data
            </p>
          </div>
          {currentPatient && (
            <div className="ml-auto flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-1.5 border border-slate-200 dark:border-slate-600">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{currentPatient.name}</p>
                <p className="text-[10px] text-slate-400">{currentPatient.age}y · {currentPatient.conditions[0]}</p>
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/30">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-purple-100 dark:from-brand-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-brand-500" />
              </div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Clinical AI Assistant</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Ask me anything about {currentPatient?.name ?? 'this patient'} — vitals, trends, medication concerns, risk factors, or clinical summaries.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {SUGGESTED_QUERIES.slice(0, 4).map(({ icon: Icon, label, query }) => (
                  <button
                    key={label}
                    onClick={() => sendMessage(query)}
                    disabled={loading}
                    className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-700 dark:hover:text-brand-400 transition-colors text-left disabled:opacity-40"
                  >
                    <Icon className="w-4 h-4 text-brand-400 shrink-0" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {msg.role === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.flagged && (
                  <div className="mt-2 flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs border-t border-amber-200 dark:border-amber-800 pt-2">
                    <AlertTriangle className="w-3 h-3" />
                    Caregiver alert triggered
                  </div>
                )}
                <div className="flex items-center justify-between mt-1.5 gap-3">
                  <p className={`text-[10px] ${msg.role === 'user' ? 'text-brand-200' : 'text-slate-400 dark:text-slate-500'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {msg.sentiment && msg.role === 'ai' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      msg.sentiment === 'urgent'      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                      msg.sentiment === 'informative' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' :
                      msg.sentiment === 'reassuring'  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' :
                      'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {msg.sentiment}
                    </span>
                  )}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-500 dark:text-slate-300" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Analysing patient data…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={currentPatient ? `Ask a clinical question about ${currentPatient.name}…` : 'Select a patient to begin…'}
              disabled={!selectedPatient}
              className="flex-1 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-700 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim() || !selectedPatient}
              className="px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 text-center">
            AI responses are grounded in real patient vitals, history, and risk assessments via RAG memory
          </p>
        </div>
      </div>
    </div>
  );
}
