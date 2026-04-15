/**
 * AI Companion Flow (Firebase Genkit)
 * Conversational AI companion for elderly patients
 * Features: daily check-ins, medication reminders, emotional support
 * Uses Gemini Flash for low-latency responses
 */

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { healthMemory } from '../rag/healthMemoryService';
import { ConversationMessage } from '../types/health.types';
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

    const firstName = patient ? patient.name.split(' ')[0] : (input.language === 'bm' ? 'Kawan' : 'Friend');
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';

    const isBM = input.language === 'bm';

    const systemPrompt = `You are CareSphere AI, a healthcare companion for elderly Malaysian patients, aligned with Malaysian Ministry of Health (MOH) guidelines.

RETRIEVED PATIENT HEALTH CONTEXT (RAG):
${healthContext}

YOUR ROLE & BEHAVIOUR:
- Warm, patient, empathetic — speak like a caring family member, NOT a robot
- Use simple, clear language appropriate for elderly users
- ${isBM
  ? 'Respond ENTIRELY in Bahasa Malaysia. Bahasa mudah dan mesra. Boleh campur sedikit Inggeris semula jadi ("okay", "check-up", "follow-up"). Sapaan: "Pak Cik", "Mak Cik", atau nama pertama.'
  : 'Respond in English. Mix in occasional Malay flavour naturally ("okay lah", "no worries lah", "take care ya").'}
- Address the patient by first name: ${firstName}
- NEVER repeat the same generic greeting — be contextually specific to this conversation
- Celebrate wins, but act decisively on health concerns
- You are an AGENTIC AI: take autonomous action when needed (alert caregiver, recommend clinic, escalate)

LANGUAGE: ${isBM ? 'BAHASA MALAYSIA penuh' : 'ENGLISH with Malay flavour'}
SESSION: ${input.sessionType}
GREETING: ${isBM ? (greeting === 'morning' ? 'Selamat pagi' : greeting === 'afternoon' ? 'Selamat tengah hari' : 'Selamat malam') : `Good ${greeting}`}

${input.sessionType === 'medication_reminder'
  ? `MEDICATION MODE: Medications = ${patient?.medications.join(', ')}. Gently confirm taken. Note any side effects mentioned.`
  : ''}
${input.sessionType === 'daily_checkin'
  ? `DAILY CHECK-IN MODE: Ask how they feel, pain/discomfort, sleep quality, appetite, mood. Conversational, not clinical.`
  : ''}
${input.sessionType === 'emotional_support'
  ? `EMOTIONAL SUPPORT MODE: Listen actively, validate feelings, offer comfort. Don't rush to solutions. Suggest calling family if lonely.`
  : ''}

CONVERSATION HISTORY (last 8 turns):
${conversationHistory.map((m) => `${m.role === 'user' ? firstName : 'CareSphere'}: ${m.content}`).join('\n')}

CURRENT MESSAGE FROM ${firstName}: "${input.userMessage}"

RESPONSE STRUCTURE — your "response" field MUST include these 4 elements naturally (weave them into a single warm message, not a numbered list):

1. POSSIBLE CAUSE — briefly explain the likely reason for their concern, based on their health history and what they described (e.g., "This could be related to your blood pressure medication…")
2. SIMPLE ADVICE — 1–2 specific, actionable things they can do RIGHT NOW (drink water, rest, check BP, take their medication, call someone)
3. KLINIK KESIHATAN GUIDANCE — if warranted, advise whether to visit their nearest Klinik Kesihatan or Hospital Kerajaan. For non-urgent concerns say "if this continues for more than X days, see your Klinik Kesihatan". For urgent, say to go TODAY.
4. CAREGIVER ALERT (if serious) — if symptoms are concerning, mention you are alerting their caregiver so they can check in

HIGH RISK TRIGGERS (flag immediately + set flaggedForCaregiver=true):
chest pain, cannot breathe, severe dizziness, fall/fell, stroke symptoms, confusion, seizure, unconscious, severe bleeding, choking, fainting
BM: sakit dada, sesak nafas, pening teruk, jatuh, strok, keliru, pengsan, pitam, berdarah teruk, tercekik, kejang

AGENTIC ACTIONS to take based on risk level:
- LOW risk: reassure, give self-care advice, suggest next scheduled check-up
- MEDIUM risk: advise Klinik Kesihatan visit within 1–2 days, remind about medications
- HIGH risk: emergency escalation — 999 or nearest A&E, MUST flag caregiver

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "response": "<warm, specific, human response weaving all 4 elements above — do NOT be generic>",
  "sentiment": "supportive|informative|urgent|reassuring",
  "followUpSuggestions": ["<specific suggestion 1>", "<specific suggestion 2>", "<specific suggestion 3>"],
  "medicationReminders": ["<med name + time if applicable>"],
  "flaggedForCaregiver": <true|false>,
  "flagReason": "<brief clinical reason if flagged, else omit>"
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
    const geminiResult = await callGeminiJSON<z.infer<typeof CompanionOutputSchema>>(
      systemPrompt,
      { temperature: 0.7, maxOutputTokens: 1024 }
    );

    if (geminiResult) {
      try {
        const result = CompanionOutputSchema.parse(geminiResult);
        storeMessage('model', result.response);
        console.log(`[companionFlow] Gemini 2.5 Flash ✓ sentiment=${result.sentiment} flagged=${result.flaggedForCaregiver}`);
        return result;
      } catch (parseErr) {
        console.warn('[companionFlow] Gemini result failed schema validation, using fallback');
      }
    } else {
      console.log('[companionFlow] Gemini unavailable — using fallback response');
    }

    const fallbackResponse = getFallbackResponse(input.userMessage, firstName, patient?.medications || [], input.language);
    storeMessage('model', fallbackResponse.response);
    return fallbackResponse;
  }
);

function getFallbackResponse(
  message: string,
  firstName: string,
  medications: string[],
  language: 'en' | 'bm' = 'en'
): z.infer<typeof CompanionOutputSchema> {
  const lowerMsg = message.toLowerCase();

  // Urgent symptom keywords — English + Bahasa Malaysia
  const urgentKeywords = [
    // English
    'chest pain', "can't breathe", 'cannot breathe', 'dizzy', 'fall', 'fell',
    'heart', 'stroke', 'numb', 'confusion', 'confused', 'seizure', 'unconscious',
    'severe bleeding', 'choking', 'faint', 'collapsed',
    // Bahasa Malaysia
    'sakit dada', 'sesak nafas', 'pening', 'jatuh', 'tercekik', 'pengsan',
    'strok', 'kebas', 'kejang', 'pitam', 'berdarah teruk',
  ];
  const isUrgent = urgentKeywords.some((kw) => lowerMsg.includes(kw));

  const isBM = language === 'bm';

  // ── HIGH RISK: emergency response ──────────────────────────────────────────
  if (isUrgent) {
    return {
      response: isBM
        ? `${firstName}, saya sangat bimbang dengan keadaan anda sekarang. Gejala yang anda sebut boleh menjadi tanda kecemasan perubatan. Jangan tunggu — sila duduk atau berbaring di tempat yang selamat, hubungi 999 atau minta seseorang bawa anda ke Jabatan Kecemasan Hospital Kerajaan terdekat dengan segera. Saya telah menghantar amaran kepada penjaga anda supaya mereka boleh bersama anda secepat mungkin. Jangan berseorangan ya.`
        : `${firstName}, I'm really concerned about what you've described — these symptoms can sometimes be a sign of a medical emergency. Please sit or lie down somewhere safe right now. Call 999 or have someone take you to the nearest Hospital Kerajaan A&E immediately — don't wait. I've already alerted your caregiver so they're on their way to check on you. You're not alone in this.`,
      sentiment: 'urgent',
      followUpSuggestions: isBM
        ? ['Hubungi 999 sekarang', 'Minta seseorang menemani anda', 'Duduk atau berbaring dengan selamat']
        : ['Call 999 immediately', 'Ask someone to stay with you', 'Sit or lie down safely'],
      medicationReminders: [],
      flaggedForCaregiver: true,
      flagReason: isBM
        ? 'Gejala kecemasan yang berpotensi disebut — tindakan segera diperlukan'
        : 'Potential emergency symptoms mentioned — immediate action required',
    };
  }

  // ── Symptom keywords that warrant Klinik Kesihatan advice ───────────────────
  const clinicKeywords = [
    'headache', 'sakit kepala', 'tired', 'penat', 'lelah', 'cough', 'batuk',
    'fever', 'demam', 'pain', 'sakit', 'swollen', 'bengkak', 'nausea', 'loya',
    'vomit', 'muntah', 'diarrhoea', 'cirit', 'blood pressure', 'tekanan darah',
    'sugar', 'gula', 'glucose', 'glucos', 'breathless', 'shortness',
  ];
  const needsClinicAdvice = clinicKeywords.some((kw) => lowerMsg.includes(kw));

  if (needsClinicAdvice) {
    return {
      response: isBM
        ? `${firstName}, terima kasih kerana memberitahu saya. Gejala yang anda rasa mungkin berkaitan dengan keadaan kesihatan anda yang sedia ada. Untuk masa ini, cuba rehat yang cukup, minum air yang banyak, dan pastikan anda ambil ubat seperti yang ditetapkan. Jika gejala ini berterusan lebih dari dua hari atau semakin teruk, sila pergi ke Klinik Kesihatan berhampiran anda — mereka boleh bantu dengan pemeriksaan lanjut tanpa perlu bayaran yang tinggi. Saya juga telah mengemas kini rekod kesihatan anda supaya penjaga anda tahu tentang keadaan ini.`
        : `${firstName}, thank you for telling me about this. What you're feeling might be related to your existing health condition — it's good that you noticed it. For now, try to rest well, drink plenty of water, and make sure you take your medications as prescribed. If this symptom continues for more than two days or gets worse, please visit your nearest Klinik Kesihatan — they can do a proper check-up at low cost. I've updated your health record so your caregiver is aware, lah.`,
      sentiment: 'informative',
      followUpSuggestions: isBM
        ? ['Pergi Klinik Kesihatan jika tidak baik dalam 2 hari', 'Minum air yang banyak dan berehat', 'Ambil ubat seperti yang ditetapkan']
        : ['Visit Klinik Kesihatan if no improvement in 2 days', 'Stay hydrated and rest well', 'Take your medications as prescribed'],
      medicationReminders: medications.slice(0, 2).map((m) =>
        isBM ? `Jangan lupa ambil ${m} seperti yang ditetapkan` : `Remember to take your ${m} as prescribed`
      ),
      flaggedForCaregiver: false,
    };
  }

  // ── Default supportive response ─────────────────────────────────────────────
  return {
    response: isBM
      ? `${firstName}, saya sentiasa di sini untuk anda! Bagaimana perasaan anda hari ini? Jika ada apa-apa yang mengganggu anda — sama ada sakit, kebimbangan, atau sekadar mahu berbual — sila ceritakan. Jangan lupa ambil ubat anda tepat pada masanya, dan kalau ada apa-apa yang tidak kena, lebih baik pergi ke Klinik Kesihatan awal dari lewat ya.`
      : `Good to hear from you, ${firstName}! I'm here for you anytime. How are you feeling today? If anything is bothering you — whether it's a health concern, your medications, or you just want to chat — please tell me lah. Remember to take your medicines on time, and if anything feels off, it's always better to check with your Klinik Kesihatan early, okay?`,
    sentiment: 'supportive',
    followUpSuggestions: isBM
      ? ['Bagaimana perasaan anda hari ini?', 'Sudah ambil ubat pagi ini?', 'Ada sebarang sakit atau ketidakselesaan?']
      : ['How are you feeling today?', 'Have you taken your morning medications?', 'Any pain or discomfort to report?'],
    medicationReminders: medications.slice(0, 2).map((m) =>
      isBM ? `Jangan lupa ambil ${m}` : `Remember to take your ${m}`
    ),
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
