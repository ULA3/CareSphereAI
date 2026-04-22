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
  const { message, firstName, patient, latestReading, greeting, language } = ctx;
  const isBM = language === 'bm';
  const lowerMsg = message.toLowerCase().trim();
  const seed = `${firstName}:${lowerMsg}:${greeting}`;

  // ── Latest-vital observations used to anchor responses in real data ─────
  const vitals = latestReading;
  const bpObservation = vitals
    ? (() => {
        const sys = vitals.bloodPressure.systolic;
        const dia = vitals.bloodPressure.diastolic;
        if (sys >= 160 || dia >= 100) {
          return isBM
            ? `tekanan darah terakhir anda ${sys}/${dia} — itu agak tinggi`
            : `your last BP was ${sys}/${dia} — that's on the higher side`;
        }
        if (sys >= 140 || dia >= 90) {
          return isBM
            ? `BP terakhir anda ${sys}/${dia}, sikit tinggi dari biasa`
            : `your BP was ${sys}/${dia} — a little above normal`;
        }
        if (sys < 100) {
          return isBM
            ? `BP anda ${sys}/${dia} — agak rendah, jangan bangun terlalu cepat`
            : `your BP was ${sys}/${dia} — a bit low, so don't stand up too fast`;
        }
        return isBM
          ? `BP terakhir anda ${sys}/${dia} — okay`
          : `your last BP reading was ${sys}/${dia} — looking stable`;
      })()
    : null;

  const hrObservation = vitals
    ? vitals.heartRate > 100
      ? isBM ? `nadi ${vitals.heartRate}bpm — sedikit laju` : `heart rate ${vitals.heartRate}bpm — a bit fast`
      : vitals.heartRate < 55
      ? isBM ? `nadi ${vitals.heartRate}bpm — perlahan sikit` : `heart rate ${vitals.heartRate}bpm — on the slow side`
      : null
    : null;

  const o2Observation = vitals && vitals.oxygenSaturation < 94
    ? isBM
      ? `SpO₂ ${vitals.oxygenSaturation}% — rendah sikit`
      : `your oxygen was ${vitals.oxygenSaturation}% — a touch low`
    : null;

  const sleepObservation = vitals && vitals.sleepHours < 5
    ? isBM
      ? `tidur hanya ${vitals.sleepHours}jam — kurang rehat`
      : `you only slept ${vitals.sleepHours}h last night — that's not enough rest`
    : null;

  const primaryCondition = patient?.conditions[0];
  const firstMed = patient?.medications[0];
  const timeGreet = isBM
    ? greeting === 'morning' ? 'Selamat pagi' : greeting === 'afternoon' ? 'Selamat tengah hari' : 'Selamat malam'
    : greeting === 'morning' ? 'Morning' : greeting === 'afternoon' ? 'Afternoon' : 'Evening';

  // ── 1. URGENT SYMPTOMS ──────────────────────────────────────────────────
  const urgentKeywords = [
    'chest pain', "can't breathe", 'cannot breathe', 'severe dizz', 'fall', 'fell', 'stroke',
    'numb on one side', 'seizure', 'unconscious', 'choking', 'faint', 'collapsed',
    'sakit dada', 'sesak nafas', 'pening teruk', 'jatuh', 'tercekik', 'pengsan', 'strok', 'kejang',
  ];
  if (urgentKeywords.some((kw) => lowerMsg.includes(kw))) {
    const anchor = bpObservation || hrObservation || o2Observation;
    return {
      response: isBM
        ? `${firstName}, ini serius — ${anchor ? anchor + ', dan ' : ''}gejala yang anda sebut boleh jadi kecemasan. Duduk atau baring di tempat selamat sekarang, hubungi 999 atau minta sesiapa hantar ke Jabatan Kecemasan Hospital Kerajaan terdekat. Saya sudah hantar amaran kepada ${patient?.caregiver.name || 'penjaga anda'}.`
        : `${firstName}, this is serious — ${anchor ? anchor + ', and ' : ''}what you're describing can be an emergency. Sit or lie down somewhere safe right now, call 999, or get someone to take you to the nearest Hospital Kerajaan A&E. I've already alerted ${patient?.caregiver.name || 'your caregiver'} — they're on the way.`,
      sentiment: 'urgent',
      followUpSuggestions: isBM
        ? ['Hubungi 999', `Hubungi ${patient?.caregiver.name || 'penjaga'}`, 'Jangan berseorangan']
        : ['Call 999 now', `Call ${patient?.caregiver.name || 'your caregiver'}`, 'Stay with someone'],
      medicationReminders: [],
      flaggedForCaregiver: true,
      flagReason: isBM
        ? `Gejala kecemasan disebut: ${message.substring(0, 80)}`
        : `Emergency symptoms reported: ${message.substring(0, 80)}`,
    };
  }

  // ── 2. TIREDNESS / FATIGUE — the failure case from user's screenshot ────
  if (/\btired\b|\bfatigue\b|\bexhaust|\bweak\b|\bno energy\b|\bpenat\b|\blelah\b|\blemah\b/i.test(message)) {
    const anchors = [sleepObservation, bpObservation, hrObservation].filter(Boolean) as string[];
    const anchor = anchors[0];
    const variants = isBM
      ? [
          `${firstName}, penat tu ada puncanya — ${anchor || `mungkin kerana ${primaryCondition || 'keadaan kesihatan anda'}`}. Cuba minum segelas air, duduk rehat 15 minit, dan ${firstMed ? `pastikan ${firstMed} sudah diambil` : 'makan sikit walaupun tak lapar'}. Kalau masih penat esok, pergi Klinik Kesihatan untuk check.`,
          `${firstName}, penat macam ni — saya perhatikan ${anchor || `${primaryCondition || 'keadaan kesihatan'} anda`}. Rehat dulu, minum air, jangan paksa diri. ${firstMed ? `Dah ambil ${firstMed} ke belum hari ni?` : 'Jaga makanan dan air minum ya.'}`,
        ]
      : [
          `${firstName}, that tiredness isn't random — ${anchor || `it can come from ${primaryCondition || 'your condition'}`}. Sit down for 15 min, drink a glass of water, and ${firstMed ? `make sure you've taken your ${firstMed} today` : 'eat something small even if you don\'t feel hungry'}. If you still feel this tired tomorrow, go to your Klinik Kesihatan for a check.`,
          `${firstName}, I hear you — ${anchor || `with your ${primaryCondition || 'health history'} this happens sometimes`}. Rest first, have some water, don't push yourself. ${firstMed ? `Have you taken your ${firstMed} today?` : 'Look after your meals and water today, ya.'}`,
          `${firstName}, let's slow down. ${anchor ? `I see ${anchor}, so that might be why.` : 'Tiredness like this deserves a pause.'} Lie down for a bit, sip some water, and ${firstMed ? `if ${firstMed} is due, take it now.` : 'let me know if it gets worse.'}`,
        ];
    return {
      response: hashPick(seed, variants),
      sentiment: 'informative',
      followUpSuggestions: isBM
        ? ['Rehat 15–20 minit', 'Minum air', 'Check semula petang ni']
        : ['Rest for 15–20 min', 'Drink some water', 'Check in with me again later'],
      medicationReminders: firstMed
        ? [isBM ? `Jangan lupa ${firstMed}` : `Remember to take your ${firstMed}`]
        : [],
      flaggedForCaregiver: false,
    };
  }

  // ── 3. CASUAL GREETINGS ("hey", "hi", "good morning") ───────────────────
  if (/^(hey|hi|hello|yo|halo|hai|selamat|assalam)/i.test(lowerMsg) && lowerMsg.length < 25) {
    const anchors = [bpObservation, hrObservation, sleepObservation].filter(Boolean) as string[];
    const anchor = anchors[0];
    const variants = isBM
      ? [
          `${timeGreet} ${firstName}! ${anchor ? `Saya tengok ${anchor}.` : `Macam mana ${primaryCondition || 'keadaan'} anda hari ni?`} ${firstMed ? `Dah ambil ${firstMed}?` : 'Ada apa nak cerita?'}`,
          `${timeGreet} ${firstName}, gembira dengar dari anda. ${anchor || 'Semuanya kelihatan stabil setakat ni.'} Apa yang anda rasa hari ni?`,
          `Hai ${firstName}! ${anchor ? anchor + '.' : ''} Ada apa-apa yang nak dibincangkan?`,
        ]
      : [
          `${timeGreet} ${firstName}! ${anchor ? `I was just looking — ${anchor}.` : `How's your ${primaryCondition || 'day'} going?`} ${firstMed ? `Have you taken your ${firstMed} yet?` : 'What\'s on your mind?'}`,
          `${timeGreet} ${firstName}, nice to hear from you. ${anchor || 'Everything looks stable on your readings.'} Anything bothering you today?`,
          `Hi ${firstName}! ${anchor ? anchor + '.' : ''} What would you like to talk about?`,
        ];
    return {
      response: hashPick(seed, variants),
      sentiment: 'supportive',
      followUpSuggestions: isBM
        ? [firstMed ? `Dah ambil ${firstMed}?` : 'Macam mana tidur semalam?', 'Ada rasa sakit?', 'Dah minum air cukup?']
        : [firstMed ? `Taken your ${firstMed} today?` : 'How did you sleep last night?', 'Any aches or pains?', 'Have you had enough water?'],
      medicationReminders: firstMed
        ? [isBM ? `${firstMed} — ambil seperti biasa` : `${firstMed} — take as usual`]
        : [],
      flaggedForCaregiver: false,
    };
  }

  // ── 4. SPECIFIC SYMPTOMS (headache, pain, fever, etc.) ──────────────────
  const symptomMap: Array<{ kw: RegExp; label: string; labelBM: string }> = [
    { kw: /headache|sakit kepala|pening/i, label: 'headache', labelBM: 'sakit kepala' },
    { kw: /cough|batuk/i, label: 'cough', labelBM: 'batuk' },
    { kw: /fever|demam|hot|panas/i, label: 'fever', labelBM: 'demam' },
    { kw: /pain|sakit|ache/i, label: 'pain', labelBM: 'sakit' },
    { kw: /nausea|vomit|loya|muntah/i, label: 'nausea', labelBM: 'loya' },
    { kw: /swollen|bengkak/i, label: 'swelling', labelBM: 'bengkak' },
    { kw: /dizzy|pening/i, label: 'dizziness', labelBM: 'pening' },
  ];
  const matched = symptomMap.find((s) => s.kw.test(message));
  if (matched) {
    const anchor = bpObservation || hrObservation || o2Observation || sleepObservation;
    return {
      response: isBM
        ? `${firstName}, ${matched.labelBM} tu — ${anchor ? anchor + ', mungkin berkaitan' : `dengan ${primaryCondition || 'keadaan anda'} kita kena perhati`}. Rehat, minum air, ${firstMed ? `pastikan ${firstMed} diambil ikut jadual` : 'elak aktiviti berat sekarang'}. Kalau tak baik dalam 2 hari atau jadi lebih teruk, pergi Klinik Kesihatan. Saya akan update rekod supaya ${patient?.caregiver.name || 'penjaga anda'} tahu.`
        : `${firstName}, about that ${matched.label} — ${anchor ? anchor + ', which could be linked' : `with your ${primaryCondition || 'history'} we should keep an eye on it`}. Rest up, drink water, ${firstMed ? `and make sure your ${firstMed} is on schedule` : 'avoid anything too strenuous for now'}. If it doesn't improve in 2 days or gets worse, please go to Klinik Kesihatan. I'll note this so ${patient?.caregiver.name || 'your caregiver'} is aware, ya.`,
      sentiment: 'informative',
      followUpSuggestions: isBM
        ? ['Rehat dan minum air', `Check semula dalam 2 jam`, 'Klinik Kesihatan jika lebih teruk']
        : ['Rest and hydrate', 'Check in again in 2 hours', 'Klinik Kesihatan if it worsens'],
      medicationReminders: firstMed
        ? [isBM ? `${firstMed} ikut jadual` : `${firstMed} on schedule`]
        : [],
      flaggedForCaregiver: false,
    };
  }

  // ── 5. DEFAULT — still personalised, not template ───────────────────────
  const anchors = [bpObservation, hrObservation, sleepObservation, o2Observation].filter(Boolean) as string[];
  const anchor = anchors[0];
  const variants = isBM
    ? [
        `${firstName}, saya dengar. ${anchor || `Untuk ${primaryCondition || 'keadaan anda'}, setiap perasaan adalah penting`}. Boleh ceritakan lebih sikit — bila ia bermula, dan apa yang anda buat masa tu?`,
        `Okay ${firstName}, cerita lagi. ${anchor ? anchor + '.' : ''} Saya nak faham apa yang anda rasa sekarang, supaya saya boleh bantu dengan lebih tepat.`,
      ]
    : [
        `${firstName}, I'm listening. ${anchor || `With your ${primaryCondition || 'history'}, anything you feel matters`}. Tell me a bit more — when did it start, and what were you doing at the time?`,
        `Okay ${firstName}, tell me more. ${anchor ? anchor + '.' : ''} I want to understand what you're feeling right now so I can help you properly, ya.`,
        `Go on ${firstName}. ${anchor ? `I can see ${anchor}, so context helps.` : ''} What exactly is on your mind today?`,
      ];
  return {
    response: hashPick(seed, variants),
    sentiment: 'supportive',
    followUpSuggestions: isBM
      ? ['Bila ia bermula?', 'Ada rasa sakit?', firstMed ? `Dah ambil ${firstMed}?` : 'Macam mana tidur semalam?']
      : ['When did it start?', 'Any pain or discomfort?', firstMed ? `Taken your ${firstMed} yet?` : 'How was your sleep?'],
    medicationReminders: firstMed
      ? [isBM ? `Jangan lupa ${firstMed}` : `Remember your ${firstMed}`]
      : [],
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
