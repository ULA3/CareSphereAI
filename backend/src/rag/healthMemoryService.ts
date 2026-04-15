/**
 * RAG-based Health Memory Service
 * Stores patient health history and provides contextual retrieval
 * Architecture: In-memory store (Firestore-compatible interface for Cloud deployment)
 */

import { HealthReading, RiskAssessment, ConversationMessage, Patient } from '../types/health.types';

interface HealthDocument {
  id: string;
  patientId: string;
  type: 'reading' | 'assessment' | 'conversation';
  content: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface MedicationSchedule {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  times: string[]; // e.g. ['08:00', '14:00', '20:00']
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  scheduledTime: string;
  date: string; // YYYY-MM-DD
  taken: boolean;
  takenAt?: string;
  notes?: string;
}

export interface PatientBaseline {
  patientId: string;
  avgHeartRate: number;
  avgSystolic: number;
  avgDiastolic: number;
  avgOxygenSaturation: number;
  avgTemperature: number;
  avgSleepHours: number;
  avgMovementScore: number;
  computedAt: string;
}

class HealthMemoryService {
  private documents: Map<string, HealthDocument[]> = new Map();
  private patients: Map<string, Patient> = new Map();
  private readings: Map<string, HealthReading[]> = new Map();
  private assessments: Map<string, RiskAssessment[]> = new Map();
  private conversations: Map<string, ConversationMessage[]> = new Map();
  private medications: Map<string, MedicationSchedule[]> = new Map();
  private medicationLogs: Map<string, MedicationLog[]> = new Map();
  private baselines: Map<string, PatientBaseline> = new Map();

  storePatient(patient: Patient): void {
    this.patients.set(patient.id, patient);
    if (!this.documents.has(patient.id)) {
      this.documents.set(patient.id, []);
    }
  }

  getPatient(patientId: string): Patient | undefined {
    return this.patients.get(patientId);
  }

  getAllPatients(): Patient[] {
    return Array.from(this.patients.values());
  }

  storeReading(reading: HealthReading): void {
    const readings = this.readings.get(reading.patientId) || [];
    readings.unshift(reading);
    if (readings.length > 100) readings.pop();
    this.readings.set(reading.patientId, readings);

    const doc: HealthDocument = {
      id: reading.id,
      patientId: reading.patientId,
      type: 'reading',
      content: this.readingToText(reading),
      metadata: { ...reading },
      timestamp: reading.timestamp,
    };
    const docs = this.documents.get(reading.patientId) || [];
    docs.unshift(doc);
    this.documents.set(reading.patientId, docs);

    // Recompute baseline every 5 new readings
    if (readings.length % 5 === 0) this.computeBaseline(reading.patientId);
  }

  storeAssessment(assessment: RiskAssessment): void {
    const assessments = this.assessments.get(assessment.patientId) || [];
    assessments.unshift(assessment);
    if (assessments.length > 50) assessments.pop();
    this.assessments.set(assessment.patientId, assessments);
  }

  getLatestReadings(patientId: string, limit = 10): HealthReading[] {
    return (this.readings.get(patientId) || []).slice(0, limit);
  }

  getLatestAssessments(patientId: string, limit = 5): RiskAssessment[] {
    return (this.assessments.get(patientId) || []).slice(0, limit);
  }

  getAllAssessments(): RiskAssessment[] {
    const all: RiskAssessment[] = [];
    this.assessments.forEach((assessments) => all.push(...assessments));
    return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  storeConversationMessage(message: ConversationMessage): void {
    const msgs = this.conversations.get(message.patientId) || [];
    msgs.push(message);
    if (msgs.length > 50) msgs.shift();
    this.conversations.set(message.patientId, msgs);
  }

  getConversationHistory(patientId: string, limit = 10): ConversationMessage[] {
    const msgs = this.conversations.get(patientId) || [];
    return msgs.slice(-limit);
  }

  // --- MEDICATIONS ---

  getMedications(patientId: string): MedicationSchedule[] {
    return this.medications.get(patientId) || [];
  }

  storeMedication(med: MedicationSchedule): void {
    const meds = this.medications.get(med.patientId) || [];
    const existing = meds.findIndex((m) => m.id === med.id);
    if (existing >= 0) meds[existing] = med;
    else meds.push(med);
    this.medications.set(med.patientId, meds);
  }

  getMedicationLogs(patientId: string, date?: string): MedicationLog[] {
    const logs = this.medicationLogs.get(patientId) || [];
    if (date) return logs.filter((l) => l.date === date);
    return logs;
  }

  storeMedicationLog(log: MedicationLog): void {
    const logs = this.medicationLogs.get(log.patientId) || [];
    const existing = logs.findIndex((l) => l.id === log.id);
    if (existing >= 0) logs[existing] = log;
    else logs.push(log);
    this.medicationLogs.set(log.patientId, logs);
  }

  getMedicationAdherence(patientId: string): { total: number; taken: number; rate: number } {
    const logs = this.medicationLogs.get(patientId) || [];
    const total = logs.length;
    const taken = logs.filter((l) => l.taken).length;
    return { total, taken, rate: total > 0 ? Math.round((taken / total) * 100) : 0 };
  }

  // --- BASELINE ANOMALY DETECTION ---

  computeBaseline(patientId: string): PatientBaseline | null {
    const readings = this.readings.get(patientId) || [];
    if (readings.length < 5) return null;

    const sample = readings.slice(0, Math.min(20, readings.length));
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const baseline: PatientBaseline = {
      patientId,
      avgHeartRate: avg(sample.map((r) => r.heartRate)),
      avgSystolic: avg(sample.map((r) => r.bloodPressure.systolic)),
      avgDiastolic: avg(sample.map((r) => r.bloodPressure.diastolic)),
      avgOxygenSaturation: avg(sample.map((r) => r.oxygenSaturation)),
      avgTemperature: avg(sample.map((r) => r.temperature)),
      avgSleepHours: avg(sample.map((r) => r.sleepHours)),
      avgMovementScore: avg(sample.map((r) => r.movementScore)),
      computedAt: new Date().toISOString(),
    };

    this.baselines.set(patientId, baseline);
    return baseline;
  }

  getBaseline(patientId: string): PatientBaseline | null {
    return this.baselines.get(patientId) || null;
  }

  detectAnomalies(patientId: string, reading: HealthReading): string[] {
    const baseline = this.baselines.get(patientId);
    if (!baseline) return [];

    const anomalies: string[] = [];
    const pct = (current: number, base: number) => Math.abs((current - base) / base) * 100;

    if (pct(reading.heartRate, baseline.avgHeartRate) > 20) {
      const dir = reading.heartRate > baseline.avgHeartRate ? 'above' : 'below';
      anomalies.push(`HR ${reading.heartRate}bpm is ${Math.round(pct(reading.heartRate, baseline.avgHeartRate))}% ${dir} this patient's baseline (${Math.round(baseline.avgHeartRate)}bpm)`);
    }
    if (pct(reading.bloodPressure.systolic, baseline.avgSystolic) > 15) {
      const dir = reading.bloodPressure.systolic > baseline.avgSystolic ? 'above' : 'below';
      anomalies.push(`Systolic BP ${reading.bloodPressure.systolic}mmHg is ${Math.round(pct(reading.bloodPressure.systolic, baseline.avgSystolic))}% ${dir} baseline (${Math.round(baseline.avgSystolic)}mmHg)`);
    }
    if (reading.oxygenSaturation < baseline.avgOxygenSaturation - 3) {
      anomalies.push(`O₂ saturation ${reading.oxygenSaturation.toFixed(1)}% is ${(baseline.avgOxygenSaturation - reading.oxygenSaturation).toFixed(1)}% below this patient's baseline (${baseline.avgOxygenSaturation.toFixed(1)}%)`);
    }
    if (pct(reading.sleepHours, baseline.avgSleepHours) > 40) {
      const dir = reading.sleepHours > baseline.avgSleepHours ? 'above' : 'below';
      anomalies.push(`Sleep ${reading.sleepHours.toFixed(1)}h is significantly ${dir} baseline (${baseline.avgSleepHours.toFixed(1)}h)`);
    }
    if (pct(reading.movementScore, baseline.avgMovementScore) > 50) {
      const dir = reading.movementScore > baseline.avgMovementScore ? 'above' : 'below';
      anomalies.push(`Movement score ${reading.movementScore.toFixed(0)}/100 is ${dir} typical level (${baseline.avgMovementScore.toFixed(0)}/100)`);
    }

    return anomalies;
  }

  // --- TREND ANALYSIS ---

  getTrendData(patientId: string, hours = 24): {
    readings: HealthReading[];
    trend: { improving: boolean; deteriorating: boolean; stable: boolean };
    weeklyAvg: Partial<PatientBaseline>;
  } {
    const all = this.readings.get(patientId) || [];
    const cutoff = Date.now() - hours * 3600000;
    const readings = all.filter((r) => new Date(r.timestamp).getTime() > cutoff).reverse();

    let trend = { improving: false, deteriorating: false, stable: true };
    if (readings.length >= 3) {
      const first3 = readings.slice(0, 3);
      const last3 = readings.slice(-3);
      const avgScore = (arr: HealthReading[]) => {
        const bpScore = arr.reduce((s, r) => s + r.bloodPressure.systolic, 0) / arr.length;
        const hrScore = arr.reduce((s, r) => s + r.heartRate, 0) / arr.length;
        const o2Score = arr.reduce((s, r) => s + r.oxygenSaturation, 0) / arr.length;
        return bpScore / 2 + hrScore / 2 - o2Score;
      };
      const delta = avgScore(last3) - avgScore(first3);
      if (delta > 10) trend = { improving: false, deteriorating: true, stable: false };
      else if (delta < -5) trend = { improving: true, deteriorating: false, stable: false };
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const weeklyAvg = {
      avgHeartRate: avg(readings.map((r) => r.heartRate)),
      avgSystolic: avg(readings.map((r) => r.bloodPressure.systolic)),
      avgOxygenSaturation: avg(readings.map((r) => r.oxygenSaturation)),
      avgSleepHours: avg(readings.map((r) => r.sleepHours)),
      avgMovementScore: avg(readings.map((r) => r.movementScore)),
    };

    return { readings, trend, weeklyAvg };
  }

  /**
   * RAG retrieval: Get relevant health context for a patient
   * Returns formatted context string for Gemini prompt grounding
   */
  retrieveHealthContext(patientId: string): string {
    const patient = this.patients.get(patientId);
    if (!patient) return 'No patient data found.';

    const recentReadings = this.getLatestReadings(patientId, 5);
    const recentAssessments = this.getLatestAssessments(patientId, 3);
    const baseline = this.baselines.get(patientId);

    const sections: string[] = [];

    sections.push(`PATIENT PROFILE:
Name: ${patient.name}, Age: ${patient.age}, Gender: ${patient.gender}
Chronic Conditions: ${patient.conditions.join(', ') || 'None'}
Current Medications: ${patient.medications.join(', ') || 'None'}
Caregiver: ${patient.caregiver.name} (${patient.caregiver.relationship}) - ${patient.caregiver.phone}`);

    if (baseline) {
      sections.push(`PATIENT PERSONAL BASELINE (computed from ${Math.min(20, this.readings.get(patientId)?.length || 0)} readings):
Avg HR: ${baseline.avgHeartRate.toFixed(1)}bpm | Avg BP: ${baseline.avgSystolic.toFixed(0)}/${baseline.avgDiastolic.toFixed(0)}mmHg
Avg O₂: ${baseline.avgOxygenSaturation.toFixed(1)}% | Avg Sleep: ${baseline.avgSleepHours.toFixed(1)}h | Avg Movement: ${baseline.avgMovementScore.toFixed(0)}/100`);
    }

    if (recentReadings.length > 0) {
      const readingTexts = recentReadings.map((r) => this.readingToText(r));
      sections.push(`RECENT HEALTH READINGS (last ${recentReadings.length}):\n${readingTexts.join('\n---\n')}`);
    }

    if (recentAssessments.length > 0) {
      const assessmentTexts = recentAssessments.map(
        (a) =>
          `[${a.timestamp}] Risk: ${a.riskLevel.toUpperCase()} (score: ${a.riskScore}/100)\nReasons: ${a.reasons.join('; ')}`
      );
      sections.push(`RECENT RISK ASSESSMENTS:\n${assessmentTexts.join('\n---\n')}`);
    }

    return sections.join('\n\n');
  }

  private readingToText(r: HealthReading): string {
    return `[${r.timestamp}] Heart Rate: ${r.heartRate}bpm, Sleep: ${r.sleepHours}h, Movement: ${r.movementScore}/100, BP: ${r.bloodPressure.systolic}/${r.bloodPressure.diastolic}mmHg, O2: ${r.oxygenSaturation}%, Temp: ${r.temperature}°C`;
  }
}

export const healthMemory = new HealthMemoryService();

export function seedDemoData(): void {
  const patients: Patient[] = [
    {
      id: 'patient-001',
      name: 'Ahmad bin Razali',
      age: 73,
      gender: 'male',
      conditions: ['Type 2 Diabetes', 'Hypertension', 'Mild Arthritis'],
      medications: ['Metformin 500mg', 'Amlodipine 5mg', 'Aspirin 100mg'],
      caregiver: {
        name: 'Siti binti Ahmad',
        phone: '+60123456789',
        email: 'siti.ahmad@email.com',
        relationship: 'Daughter',
      },
      location: {
        address: 'No. 12, Jalan Mawar',
        city: 'Johor Bahru',
        state: 'Johor',
        lat: 1.4927,
        lng: 103.7414,
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'patient-002',
      name: 'Meenakshi a/p Krishnan',
      age: 68,
      gender: 'female',
      conditions: ['Heart Disease', 'Osteoporosis'],
      medications: ['Atorvastatin 40mg', 'Calcium + Vitamin D', 'Warfarin 5mg'],
      caregiver: {
        name: 'Rajan s/o Krishnan',
        phone: '+60198765432',
        email: 'rajan.krishnan@email.com',
        relationship: 'Son',
      },
      location: {
        address: 'No. 45, Taman Melati',
        city: 'Kuala Lumpur',
        state: 'Wilayah Persekutuan',
        lat: 3.1390,
        lng: 101.6869,
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'patient-003',
      name: 'Lim Ah Kow',
      age: 80,
      gender: 'male',
      conditions: ['COPD', 'Atrial Fibrillation', 'Cognitive Decline'],
      medications: ['Salbutamol inhaler', 'Digoxin 0.25mg', 'Rivastigmine 6mg'],
      caregiver: {
        name: 'Lim Wei Ming',
        phone: '+60167891234',
        email: 'weiming.lim@email.com',
        relationship: 'Son',
      },
      location: {
        address: 'No. 8, Jalan Perdana',
        city: 'George Town',
        state: 'Pulau Pinang',
        lat: 5.4141,
        lng: 100.3288,
      },
      createdAt: new Date().toISOString(),
    },
  ];

  patients.forEach((p) => healthMemory.storePatient(p));

  const now = Date.now();
  patients.forEach((patient, pIdx) => {
    for (let i = 9; i >= 0; i--) {
      const ts = new Date(now - i * 3600000).toISOString();
      const baseHR = pIdx === 2 ? 95 : pIdx === 1 ? 78 : 72;
      const reading: HealthReading = {
        id: `reading-${patient.id}-${i}`,
        patientId: patient.id,
        timestamp: ts,
        heartRate: baseHR + Math.floor(Math.random() * 20 - 10),
        sleepHours: pIdx === 0 ? 4.5 + Math.random() * 2 : 6 + Math.random() * 2,
        movementScore: pIdx === 2 ? 20 + Math.random() * 15 : 40 + Math.random() * 40,
        bloodPressure: {
          systolic: (pIdx === 0 ? 155 : 120) + Math.floor(Math.random() * 20 - 10),
          diastolic: (pIdx === 0 ? 95 : 80) + Math.floor(Math.random() * 10 - 5),
        },
        oxygenSaturation: pIdx === 2 ? 91 + Math.random() * 4 : 96 + Math.random() * 3,
        temperature: 36.5 + Math.random() * 0.8,
        glucoseLevel: pIdx === 0 ? 8.5 + Math.random() * 4 : undefined,
      };
      healthMemory.storeReading(reading);
    }

    // Compute baseline after seeding
    healthMemory.computeBaseline(patient.id);

    // Seed demo medication schedules
    const medNames = patient.medications.slice(0, 2);
    medNames.forEach((medName, mIdx) => {
      const medId = `med-${patient.id}-${mIdx}`;
      healthMemory.storeMedication({
        id: medId,
        patientId: patient.id,
        name: medName,
        dosage: '1 tablet',
        times: mIdx === 0 ? ['08:00', '20:00'] : ['12:00'],
        createdAt: new Date().toISOString(),
      });

      // Seed some logs for last 3 days
      for (let d = 2; d >= 0; d--) {
        const date = new Date(now - d * 86400000);
        const dateStr = date.toISOString().split('T')[0];
        const times = mIdx === 0 ? ['08:00', '20:00'] : ['12:00'];
        times.forEach((t, tIdx) => {
          const taken = Math.random() > 0.25; // 75% adherence
          healthMemory.storeMedicationLog({
            id: `log-${patient.id}-${mIdx}-${d}-${tIdx}`,
            patientId: patient.id,
            medicationId: medId,
            medicationName: medName,
            scheduledTime: t,
            date: dateStr,
            taken,
            takenAt: taken ? `${dateStr}T${t}:00.000Z` : undefined,
          });
        });
      }
    });
  });
}
