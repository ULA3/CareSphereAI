/**
 * AI Companion Flow (Firebase Genkit)
 * Conversational AI companion for elderly patients
 * Features: daily check-ins, medication reminders, emotional support
 * Uses Gemini 2.5 Flash for low-latency responses, with a context-aware
 * fallback that reads real vitals when Gemini is unavailable.
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { healthMemory } from '../rag/healthMemoryService';
import { ConversationMessage, HealthReading, Patient } from '../types/health.types';
import { callGeminiJSON } from '../lib/gemini';
import { v4 as uuidv4 } from 'uuid';

const ai = genkit({ plugins: [googleAI()] });

const CompanionInputSchema = z.object({
  patientId: z.string(),
  userMessage: z.string(),
  sessionType: z.enum(['daily_checkin', 'medication_reminder', 'general', 'emotional_support']).default('general'),
  language: z.enum(['en', 'bm']).default('en'),
});

const CompanionOutputSchema = z.object({
  response: z.string(),
  sentiment: z.enum(['supportive', 'informative', 'urgent', 'reassuring']),
  followUpSuggestions: z.array(z.string()),
  medicationReminders: z.array(z.string()),
  flaggedForCaregiver: z.boolean(),
  flagReason: z.string().optional(),
});

type CompanionOutput = z.infer<typeof CompanionOutputSchema>;

// Deterministic hash used to vary fallback phrasing without RNG — same
// (patient, message) pair always picks the same variant, so it feels stable.
function hashPick<T>(seed: string, list: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length];
}

export const companionFlow = ai.defineFlow(
  {
    name: 'aiCompanion',
    inputSchema: CompanionInputSchema,
    outputSchema: CompanionOutputSchema,
  },
  async (input) => {
    const patient = healthMemory.getPatient(input.patientId);
    const healthContext = healthMemory.retrieveHealthContext(input.patientId);
    const conversationHistory = healthMemory.getConversationHistory(input.patientId, 8) ?? [];
    const latestReading = healthMemory.getLatestReadings(input.patientId, 1)[0];

    const firstName = patient ? patient.name.split(' ')[0] : (input.language === 'bm' ? 'Kawan' : 'Friend');
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';

    const isBM = input.language === 'bm';

    // ── Build a compact "live vitals" snippet the model is forced to cite ────
    const vitalsLine = latestReading
      ? `HR ${latestReading.heartRate}bpm · BP ${latestReading.bloodPressure.systolic}/${latestReading.bloodPressure.diastolic} · SpO₂ ${latestReading.oxygenSaturation}% · Temp ${latestReading.temperature}°C · Sleep ${latestReading.sleepHours}h`
      : 'No vitals on record yet.';

    const systemPrompt = `You are CareSphere AI — an expert clinical AI assistant for healthcare providers monitoring elderly Malaysian patients. You analyse real patient data and give concise, evidence-based clinical insights to doctors, nurses, and care coordinators.

═══════════════════════════════════════════
PATIENT RECORD: ${patient?.name ?? 'Unknown'} (${patient?.age ?? '?'}y, ${patient?.gender ?? 'unknown'})
CHRONIC CONDITIONS: ${patient?.conditions.join(', ') || 'None on record'}
CURRENT MEDICATIONS: ${patient?.medications.join(', ') || 'None on record'}
CAREGIVER: ${patient?.caregiver.name ?? 'N/A'} (${patient?.caregiver.relationship ?? 'N/A'}) — ${patient?.caregiver.phone ?? 'N/A'}
LATEST VITALS: ${vitalsLine}
═══════════════════════════════════════════

FULL RAG CONTEXT (patient history, readings, assessments):
${healthContext}

PREVIOUS CONVERSATION (most recent last):
${conversationHistory.length === 0 ? '(new session)' : conversationHistory.map((m) => `${m.role === 'user' ? 'Clinician' : 'AI'}: ${m.content}`).join('\n')}

CLINICIAN ASKS: "${input.userMessage}"

═══════════════════════════════════════════
HOW TO RESPOND — CLINICAL AI RULES:

1. YOU ARE TALKING TO A DOCTOR/NURSE/COORDINATOR — not to the patient. Use clinical language. Reference the patient by name (not "you").

2. ALWAYS GROUND RESPONSES IN REAL DATA. Cite specific numbers from the RAG context above — actual BP readings, SpO₂ values, risk scores, medication names. Never give generic advice that could apply to any patient.

3. BE CONCISE AND CLINICAL. 3–6 sentences for most queries. Use bullet points for summaries. Do not pad responses.

4. FOR RISK/TREND QUERIES: Identify patterns across readings. Note if vitals are improving, stable, or deteriorating. Flag anything that warrants action.

5. FOR MEDICATION QUERIES: Cross-reference medications with conditions and vitals. Flag potential interactions or adherence concerns.

6. FLAG FOR CAREGIVER (flaggedForCaregiver=true, sentiment="urgent") only if the data shows a genuine clinical emergency pattern — e.g. critical SpO₂ (<90%), hypertensive crisis (>180 systolic), or the clinician explicitly mentions an emergency.

7. END with a concrete recommended action when relevant — e.g. "Recommend scheduling a GP review within 48 hours" or "Consider adjusting Amlodipine dose given persistent Stage 2 hypertension readings."

Respond with ONLY valid JSON. No markdown, no code blocks:
{
  "response": "<clinical insight grounded in ${patient?.name ?? 'patient'}'s actual data>",
  "sentiment": "informative|reassuring|urgent|supportive",
  "followUpSuggestions": ["<clinical follow-up action>", "<relevant query>", "<monitoring recommendation>"],
  "medicationReminders": [],
  "flaggedForCaregiver": <true only for genuine emergencies>,
  "flagReason": "<only if flagged>"
}`;

    const storeMessage = (role: 'user' | 'model', content: string) => {
      const msg: ConversationMessage = {
        id: uuidv4(),
        patientId: input.patientId,
        role,
        content,
        timestamp: new Date().toISOString(),
      };
      healthMemory.storeConversationMessage(msg);
    };

    storeMessage('user', input.userMessage);

    // callGeminiJSON handles retry ×3, exponential backoff, safe JSON parsing — never throws
    const geminiResult = await callGeminiJSON<CompanionOutput>(
      systemPrompt,
      { temperature: 0.85, maxOutputTokens: 768 }
    );

    if (geminiResult) {
      try {
        const result = CompanionOutputSchema.parse(geminiResult);
        storeMessage('model', result.response);
        console.log(`[companionFlow] Gemini 2.5 Flash ✓ sentiment=${result.sentiment} flagged=${result.flaggedForCaregiver}`);
        return result;
      } catch (parseErr) {
        console.warn('[companionFlow] Gemini result failed schema validation, using smart fallback');
      }
    } else {
      console.log('[companionFlow] Gemini unavailable — using smart context-aware fallback');
    }

    const fallbackResponse = getSmartFallback({
      message: input.userMessage,
      firstName,
      patient,
      latestReading,
      conversationHistory,
      greeting,
      language: input.language,
    });
    storeMessage('model', fallbackResponse.response);
    return fallbackResponse;
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// SMART FALLBACK — runs when Gemini is unavailable.
// Uses real vitals + conditions + time-of-day + conversation history to build
// a response that feels personal, not template-y. Varied phrasing via hashPick.
// ═════════════════════════════════════════════════════════════════════════════

interface FallbackCtx {
  message: string;
  firstName: string;
  patient?: Patient;
  latestReading?: HealthReading;
  conversationHistory: ConversationMessage[];
  greeting: 'morning' | 'afternoon' | 'evening';
  language: 'en' | 'bm';
}

function getSmartFallback(ctx: FallbackCtx): CompanionOutput {
  const { message, patient, latestReading } = ctx;
  const lowerMsg = message.toLowerCase().trim();

  const v = latestReading;
  const name = patient?.name ?? 'This patient';
  const condition = patient?.conditions[0] ?? 'their condition';
  const med = patient?.medications[0];

  // Build a vitals summary string
  const vitalsSummary = v
    ? `Latest vitals — HR: ${v.heartRate}bpm, BP: ${v.bloodPressure.systolic}/${v.bloodPressure.diastolic}mmHg, SpO₂: ${v.oxygenSaturation}%, Temp: ${v.temperature}°C, Sleep: ${v.sleepHours}h.`
    : 'No recent vitals on record.';

  // Flag emergency keywords
  const urgentKeywords = ['critical', 'emergency', 'chest pain', 'can\'t breathe', 'fall', 'fell', 'seizure', 'unconscious', 'stroke', 'faint'];
  if (urgentKeywords.some((kw) => lowerMsg.includes(kw))) {
    return {
      response: `URGENT: Based on the clinical query, ${name} may require immediate attention. ${vitalsSummary} Contact ${patient?.caregiver.name ?? 'the caregiver'} (${patient?.caregiver.phone ?? 'on file'}) immediately and consider activating emergency protocol. Recommend dispatching to nearest A&E if symptoms are confirmed.`,
      sentiment: 'urgent',
      followUpSuggestions: ['Activate emergency protocol', 'Contact caregiver immediately', 'Arrange A&E transport'],
      medicationReminders: [],
      flaggedForCaregiver: true,
      flagReason: `Emergency query raised by clinician: ${message.substring(0, 80)}`,
    };
  }

  // Medication review query
  if (/medic|drug|prescri|dosage|pill|tablet/i.test(message)) {
    return {
      response: `${name} is currently on ${patient?.medications.join(', ') || 'no recorded medications'}. ${vitalsSummary} Given their diagnosis of ${condition}, ensure medication timing aligns with meal schedules and monitor for adverse interactions. ${med ? `${med} adherence should be reviewed at next consultation.` : ''}`,
      sentiment: 'informative',
      followUpSuggestions: ['Review medication adherence logs', 'Check for drug interactions', 'Schedule pharmacist review'],
      medicationReminders: [],
      flaggedForCaregiver: false,
    };
  }

  // Risk / deterioration query
  if (/risk|deterior|worsen|concern|watch|flag/i.test(message)) {
    const bpHigh = v && v.bloodPressure.systolic > 140;
    const o2Low = v && v.oxygenSaturation < 94;
    const hrHigh = v && v.heartRate > 100;
    const concerns = [
      bpHigh ? `elevated BP at ${v!.bloodPressure.systolic}/${v!.bloodPressure.diastolic}mmHg` : null,
      o2Low ? `low SpO₂ at ${v!.oxygenSaturation}%` : null,
      hrHigh ? `tachycardia at ${v!.heartRate}bpm` : null,
    ].filter(Boolean);
    return {
      response: concerns.length > 0
        ? `For ${name}, current risk indicators include: ${concerns.join(', ')}. These readings, combined with their ${condition} diagnosis, warrant close monitoring. Recommend review within 24–48 hours.`
        : `${name}'s latest readings appear relatively stable. ${vitalsSummary} Continue standard monitoring protocol and reassess if any new symptoms emerge.`,
      sentiment: concerns.length > 0 ? 'urgent' : 'reassuring',
      followUpSuggestions: ['Schedule clinical review', 'Monitor vitals every 4 hours', 'Notify caregiver of status'],
      medicationReminders: [],
      flaggedForCaregiver: concerns.length > 1,
    };
  }

  // Default clinical summary fallback
  return {
    response: `Clinical overview for ${name} (${patient?.age ?? '?'}y, ${condition}): ${vitalsSummary} Current medications: ${patient?.medications.join(', ') || 'none on record'}. Caregiver: ${patient?.caregiver.name ?? 'N/A'} (${patient?.caregiver.phone ?? 'N/A'}). Please ask a specific clinical question for a more detailed analysis.`,
    sentiment: 'informative',
    followUpSuggestions: ['Ask about vital trends', 'Request medication review', 'Check risk factors'],
    medicationReminders: [],
    flaggedForCaregiver: false,
  };
}

export async function runCompanionChat(
  patientId: string,
  message: string,
  sessionType: 'daily_checkin' | 'medication_reminder' | 'general' | 'emotional_support' = 'general',
  language: 'en' | 'bm' = 'en'
) {
  return companionFlow({ patientId, userMessage: message, sessionType, language });
}
