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

    const systemPrompt = `You are CareSphere Companion, a warm and caring AI friend for elderly Malaysian patients.

PATIENT CONTEXT (from health memory):
${healthContext}

YOUR PERSONALITY:
- Warm, patient, and empathetic — speak like a caring family member
- Use simple, clear language appropriate for elderly users
- ${isBM
  ? 'Respond ENTIRELY in Bahasa Malaysia. Gunakan bahasa yang mudah dan mesra untuk pesakit warga emas. Boleh campur sedikit bahasa Inggeris secara semula jadi (contoh: "okay", "check-up"). Guna sapaan seperti "Pak Cik", "Mak Cik", atau nama pertama.'
  : 'Respond in English. Mix in occasional Malay expressions naturally (e.g., "okay lah", "no worries lah", "take care ya").'}
- Always address the patient by their first name: ${firstName}
- Be proactive about health concerns but not alarmist
- Celebrate small wins and positive behaviors

LANGUAGE: ${isBM ? 'BAHASA MALAYSIA — respond fully in BM' : 'ENGLISH — with occasional Malay flavour'}
SESSION TYPE: ${input.sessionType}
TIME OF DAY: ${isBM ? (greeting === 'morning' ? 'Selamat pagi' : greeting === 'afternoon' ? 'Selamat tengah hari' : 'Selamat malam') : `Good ${greeting}`}

${input.sessionType === 'medication_reminder' ? `MEDICATION REMINDER MODE: Patient's medications: ${patient?.medications.join(', ')}. Gently confirm they've taken their medicines.` : ''}
${input.sessionType === 'daily_checkin' ? `DAILY CHECK-IN MODE: Ask about how they're feeling, any pain or discomfort, sleep quality, appetite. Keep it conversational.` : ''}
${input.sessionType === 'emotional_support' ? `EMOTIONAL SUPPORT MODE: Listen actively, validate feelings, offer comfort. Don't rush to solutions.` : ''}

CONVERSATION HISTORY:
${conversationHistory.map((m) => `${m.role === 'user' ? firstName : 'CareSphere'}: ${m.content}`).join('\n')}

CURRENT MESSAGE FROM ${firstName}: "${input.userMessage}"

Respond naturally and compassionately. If the patient mentions symptoms that could indicate HIGH health risk (chest pain, difficulty breathing, severe dizziness, falls), flag it as urgent.

Respond ONLY with valid JSON:
{
  "response": "<your warm, caring response to ${firstName}>",
  "sentiment": "supportive|informative|urgent|reassuring",
  "followUpSuggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"],
  "medicationReminders": ["<medication and time if relevant>"],
  "flaggedForCaregiver": <true if urgent symptoms mentioned>,
  "flagReason": "<reason if flagged>"
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

  if (isUrgent) {
    return {
      response: isBM
        ? `${firstName}, saya sangat bimbang. Sila hubungi 999 segera atau minta seseorang hantar anda ke hospital terdekat. Penjaga anda sedang dihubungi sekarang.`
        : `${firstName}, I hear you and I'm very concerned. Please call 999 immediately or have someone take you to the nearest hospital. I'm alerting your caregiver right now.`,
      sentiment: 'urgent',
      followUpSuggestions: isBM
        ? ['Hubungi 999', 'Hubungi penjaga', 'Duduk atau berbaring dengan selamat']
        : ['Call 999', 'Contact caregiver', 'Sit or lie down safely'],
      medicationReminders: [],
      flaggedForCaregiver: true,
      flagReason: isBM ? 'Gejala kecemasan mungkin disebut' : 'Possible emergency symptoms mentioned',
    };
  }

  return {
    response: isBM
      ? `Selamat datang, ${firstName}! Saya teman CareSphere anda, sedia membantu bila-bila masa. Bagaimana perasaan anda hari ini? Saya sentiasa di sini untuk berbual, ingatkan ubatan, atau sekadar menemani anda. Jaga diri baik-baik ya!`
      : `Good to hear from you, ${firstName}! I'm your CareSphere companion and I'm here for you. How are you feeling today? I'm always here to chat, help with medication reminders, or just keep you company. Take care lah!`,
    sentiment: 'supportive',
    followUpSuggestions: isBM
      ? ['Bagaimana perasaan anda hari ini?', 'Sudah minum ubat?', 'Macam mana tidur semalam?']
      : ['How are you feeling today?', 'Have you taken your medication?', 'How was your sleep?'],
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
