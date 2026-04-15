'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pill, Check, X, Plus, ChevronDown, Clock, TrendingUp } from 'lucide-react';
import { api, MedicationData, MedicationSchedule, Patient } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export default function MedicationsPage() {
  const { t } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [medData, setMedData] = useState<MedicationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '1 tablet', times: '08:00' });

  const today = new Date().toISOString().split('T')[0];
  const todayDisplay = new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const fetchMedData = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await api.getMedications(pid);
      setMedData(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.getPatients().then((ps) => {
      setPatients(ps);
      if (ps.length > 0) {
        setSelectedPatientId(ps[0].id);
      }
    });
  }, []);

  useEffect(() => {
    fetchMedData(selectedPatientId);
  }, [selectedPatientId, fetchMedData]);

  const handleMarkMedication = async (med: MedicationSchedule, time: string, taken: boolean) => {
    const key = `${med.id}-${time}`;
    setMarkingIds((prev) => new Set(prev).add(key));
    try {
      await api.logMedication(selectedPatientId, {
        medicationId: med.id,
        medicationName: med.name,
        scheduledTime: time,
        date: today,
        taken,
      });
      await fetchMedData(selectedPatientId);
    } finally {
      setMarkingIds((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const handleAddMedication = async () => {
    if (!newMed.name) return;
    try {
      await api.addMedication(selectedPatientId, {
        name: newMed.name,
        dosage: newMed.dosage,
        times: newMed.times.split(',').map((t) => t.trim()),
      });
      setNewMed({ name: '', dosage: '1 tablet', times: '08:00' });
      setShowAddForm(false);
      await fetchMedData(selectedPatientId);
    } catch (err) {
      console.error(err);
    }
  };

  const isLoggedTaken = (medId: string, time: string): boolean | null => {
    if (!medData) return null;
    const log = medData.todayLogs.find((l) => l.medicationId === medId && l.scheduledTime === time);
    if (!log) return null;
    return log.taken;
  };

  const adherence = medData?.adherence;
  const adherenceColor = adherence
    ? adherence.rate >= 80 ? 'text-emerald-400' : adherence.rate >= 60 ? 'text-amber-400' : 'text-red-400'
    : 'text-gray-400';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.medicationTracker}</h1>
          <p className="text-gray-400 mt-1 text-sm">{todayDisplay}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="appearance-none bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-emerald-500"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Medication
          </button>
        </div>
      </div>

      {/* Add Medication Form */}
      {showAddForm && (
        <div className="glass-card p-5 border-emerald-500/30 bg-emerald-500/5">
          <h3 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add New Medication
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              placeholder="Medication name (e.g. Metformin 500mg)"
              value={newMed.name}
              onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Dosage (e.g. 1 tablet)"
              value={newMed.dosage}
              onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Times (comma-separated, e.g. 08:00,20:00)"
              value={newMed.times}
              onChange={(e) => setNewMed({ ...newMed, times: e.target.value })}
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddMedication}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
              Save Medication
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : medData ? (
        <>
          {/* Adherence Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-gray-400">{t.adherenceRate}</p>
              </div>
              <p className={`text-4xl font-bold ${adherenceColor}`}>{adherence?.rate || 0}%</p>
              <p className="text-xs text-gray-500 mt-1">{adherence?.taken}/{adherence?.total} doses taken</p>
              <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    (adherence?.rate || 0) >= 80 ? 'bg-emerald-500' : (adherence?.rate || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${adherence?.rate || 0}%` }}
                />
              </div>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs text-gray-400 mb-2">Total Medications</p>
              <p className="text-4xl font-bold text-white">{medData.medications.length}</p>
              <p className="text-xs text-gray-500 mt-1">Active prescriptions</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-xs text-gray-400 mb-2">Today's Status</p>
              <p className="text-4xl font-bold text-white">{medData.todayLogs.filter((l) => l.taken).length}</p>
              <p className="text-xs text-gray-500 mt-1">of {medData.todayLogs.length} doses taken today</p>
            </div>
          </div>

          {/* Today's Medication Schedule */}
          <div className="glass-card p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Pill className="w-5 h-5 text-emerald-400" />
              {t.todayMedications}
            </h2>
            {medData.medications.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">{t.noData} — Add medications above</p>
            ) : (
              <div className="space-y-4">
                {medData.medications.map((med) => (
                  <div key={med.id} className="border border-gray-800 rounded-xl overflow-hidden">
                    {/* Medication Header */}
                    <div className="bg-gray-800/70 px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Pill className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{med.name}</p>
                        <p className="text-xs text-gray-400">{med.dosage}</p>
                      </div>
                    </div>
                    {/* Dose Schedule */}
                    <div className="divide-y divide-gray-800/50">
                      {med.times.map((time) => {
                        const status = isLoggedTaken(med.id, time);
                        const key = `${med.id}-${time}`;
                        const isMarking = markingIds.has(key);
                        return (
                          <div key={time} className="px-4 py-3 flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <Clock className="w-3.5 h-3.5 text-gray-500" />
                              <span className="text-sm text-gray-300 font-mono">{time}</span>
                              {status === true && (
                                <span className="text-xs text-emerald-400 flex items-center gap-1 ml-2">
                                  <Check className="w-3 h-3" /> Taken
                                </span>
                              )}
                              {status === false && (
                                <span className="text-xs text-red-400 flex items-center gap-1 ml-2">
                                  <X className="w-3 h-3" /> Missed
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleMarkMedication(med, time, true)}
                                disabled={isMarking || status === true}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                  status === true
                                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-default'
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                                } disabled:opacity-50`}
                              >
                                <Check className="w-3 h-3 inline mr-1" />{t.markTaken}
                              </button>
                              <button
                                onClick={() => handleMarkMedication(med, time, false)}
                                disabled={isMarking || status === false}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                  status === false
                                    ? 'bg-red-500/30 text-red-300 border border-red-500/40 cursor-default'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                                } disabled:opacity-50`}
                              >
                                <X className="w-3 h-3 inline mr-1" />{t.markMissed}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adherence Tips */}
          {(adherence?.rate || 0) < 80 && (
            <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5">
              <p className="text-sm font-semibold text-amber-400 mb-2">💊 Medication Adherence Tips</p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Set phone alarms for each medication time</li>
                <li>• Use a weekly pill organiser to track doses</li>
                <li>• Ask your caregiver to send daily reminders</li>
                <li>• Talk to your doctor if side effects cause you to skip doses</li>
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">{t.noData}</div>
      )}
    </div>
  );
}
