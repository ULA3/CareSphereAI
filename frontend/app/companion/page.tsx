'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send, Brain, User, Stethoscope,
  FileText, TrendingUp, Pill, AlertTriangle, Loader2, Sparkles, Search, X, ChevronRight
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
  { icon: TrendingUp,    label: 'Vital trend summary',      query: "Give me a summary of this patient's vital signs trend over the past week." },
  { icon: Pill,          label: 'Medication review',         query: "Review this patient's current medications and flag any concerns." },
  { icon: AlertTriangle, label: 'Risk factors',              query: 'What are the top risk factors I should be monitoring for this patient?' },
  { icon: FileText,      label: 'Clinical summary',          query: "Generate a concise clinical summary of this patient's current health status." },
  { icon: Stethoscope,   label: 'Condition assessment',      query: "Based on the latest readings, how well-controlled are this patient's chronic conditions?" },
  { icon: TrendingUp,    label: 'Deterioration signs',       query: 'Are there any early signs of health deterioration I should be concerned about?' },
];

export default function ClinicalAssistantPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getPatients().then((ps) => setPatients(ps));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredPatients = searchQuery.trim()
    ? patients.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.conditions.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 8)
    : patients.slice(0, 8);

  const selectPatient = (id: string) => {
    setSelectedPatient(id);
    setMessages([]);
    setSearchQuery('');
    setSearchOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

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
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mt-6 animate-fade-in">

      {/* ── Left Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-slate-200/80 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm">

        {/* Branding */}
        <div className="px-5 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-tight">AI Clinical Assistant</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
            Gemini 2.5 Flash · RAG Memory
          </p>
        </div>

        {/* Patient Search */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 px-1">Patient</p>
          <div ref={searchRef} className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search patients…"
                className="w-full bg-slate-100/80 dark:bg-slate-800/60 border border-transparent focus:border-violet-300 dark:focus:border-violet-600 rounded-lg pl-8 pr-7 py-2 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchOpen(true); }} className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {searchOpen && (
              <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200/80 dark:border-slate-700 overflow-hidden max-h-56 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-400 text-center">No patients found</p>
                ) : (
                  filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectPatient(p.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors border-b border-slate-100/60 dark:border-slate-700/60 last:border-0 ${
                        selectedPatient === p.id ? 'bg-violet-50 dark:bg-violet-900/20' : ''
                      }`}
                    >
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{p.name}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{p.age}y · {p.location.city}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected patient card */}
          {currentPatient && (
            <div className="mt-3 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border border-violet-100 dark:border-violet-800/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shrink-0">
                  <User className="w-3 h-3 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{currentPatient.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{currentPatient.age}y · {currentPatient.gender}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {currentPatient.conditions.slice(0, 2).map((c) => (
                  <span key={c} className="text-[9px] font-medium bg-white/70 dark:bg-slate-800/50 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-700/50 rounded-full px-2 py-0.5">{c}</span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">{currentPatient.medications.length} medications</p>
            </div>
          )}
        </div>

        {/* Quick queries */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 px-1">Quick Queries</p>
          <div className="space-y-0.5">
            {SUGGESTED_QUERIES.map(({ icon: Icon, label, query }) => (
              <button
                key={label}
                onClick={() => sendMessage(query)}
                disabled={loading || !selectedPatient}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left transition-all hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-35 group"
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors" />
                <span className="flex-1 truncate">{label}</span>
                <ChevronRight className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 text-slate-400 transition-opacity" />
              </button>
            ))}
          </div>
        </div>

        {/* AI status footer */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Gemini 2.5 Flash active</span>
          </div>
        </div>
      </aside>

      {/* ── Main Chat Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">

        {/* Chat header — only shown when patient selected */}
        {currentPatient && (
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Consulting on <span className="text-violet-600 dark:text-violet-400">{currentPatient.name}</span></p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">{currentPatient.age}y · {currentPatient.conditions[0]} · {currentPatient.medications.length} medications</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live patient data
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full px-4 py-6">

            {/* ── Empty state: no patient ── */}
            {!selectedPatient && (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-violet-200 dark:shadow-violet-900/40">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2 tracking-tight">AI Clinical Assistant</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-8">
                  Search for a patient on the left, then ask clinical questions — vitals, trends, medication review, risk assessment, and more.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {['Vital trend summary', 'Medication concerns', 'Risk factors', 'Clinical summary'].map((chip) => (
                    <span key={chip} className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 cursor-default">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Empty state: patient selected, no messages ── */}
            {selectedPatient && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4 shadow-md shadow-violet-200 dark:shadow-violet-900/40">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1.5 tracking-tight">
                  Ready for {currentPatient?.name}
                </h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm mb-7 leading-relaxed">
                  Ask anything about this patient — vitals, trends, medications, or a full clinical summary.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-xl">
                  {SUGGESTED_QUERIES.map(({ label, query }) => (
                    <button
                      key={label}
                      onClick={() => sendMessage(query)}
                      disabled={loading}
                      className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800/60 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-700 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all disabled:opacity-40"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Message list ── */}
            <div className="space-y-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-3`}>

                  {/* AI avatar */}
                  {msg.role === 'ai' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Brain className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-tr-sm shadow-sm shadow-violet-200 dark:shadow-violet-900/30'
                        : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 rounded-tl-sm border border-slate-200/60 dark:border-slate-700/60'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {msg.flagged && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs border-t border-amber-200/60 dark:border-amber-700/40 pt-2">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Caregiver alert triggered
                        </div>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className={`flex items-center gap-2 mt-1 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.sentiment && msg.role === 'ai' && (
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          msg.sentiment === 'urgent'      ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400' :
                          msg.sentiment === 'informative' ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' :
                          msg.sentiment === 'reassuring'  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {msg.sentiment}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Brain className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5">
                    <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">Analysing patient data…</span>
                  </div>
                </div>
              )}
            </div>

            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* ── Input bar ───────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 pb-5 pt-3 bg-white dark:bg-slate-900 border-t border-slate-100/80 dark:border-slate-800/60">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm focus-within:border-violet-300 dark:focus-within:border-violet-600 focus-within:ring-2 focus-within:ring-violet-500/15 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={currentPatient ? `Ask a clinical question about ${currentPatient.name}…` : 'Select a patient to begin…'}
                disabled={!selectedPatient}
                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim() || !selectedPatient}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md hover:shadow-violet-200 dark:hover:shadow-violet-900/40 transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center mt-2.5">
              Responses are grounded in real patient vitals, history, and risk assessments via RAG memory
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
