/**
 * Caregiver Alert Tool
 * Genkit tool that autonomously notifies caregivers when high risk is detected
 */

import { z } from 'zod';
import { AlertRecord } from '../types/health.types';
import { healthMemory } from '../rag/healthMemoryService';
import { v4 as uuidv4 } from 'uuid';

export const caregiverAlertInputSchema = z.object({
  patientId: z.string().describe('The ID of the patient at risk'),
  riskLevel: z.enum(['low', 'medium', 'high']).describe('The assessed risk level'),
  riskReasons: z.array(z.string()).describe('List of reasons for the risk assessment'),
  urgencyMessage: z.string().describe('Urgent message to send to the caregiver'),
});

export const caregiverAlertOutputSchema = z.object({
  success: z.boolean(),
  alertId: z.string(),
  caregiverName: z.string(),
  caregiverContact: z.string(),
  messageSent: z.string(),
  channel: z.string(),
  timestamp: z.string(),
});

export type CaregiverAlertInput = z.infer<typeof caregiverAlertInputSchema>;
export type CaregiverAlertOutput = z.infer<typeof caregiverAlertOutputSchema>;

export async function sendCaregiverAlert(input: CaregiverAlertInput): Promise<CaregiverAlertOutput> {
  const patient = healthMemory.getPatient(input.patientId);
  if (!patient) {
    return {
      success: false,
      alertId: '',
      caregiverName: 'Unknown',
      caregiverContact: '',
      messageSent: 'Patient not found',
      channel: 'none',
      timestamp: new Date().toISOString(),
    };
  }

  const alertId = uuidv4();
  const timestamp = new Date().toISOString();

  const message = `[CareSphere AI Alert] 🚨 ${input.riskLevel.toUpperCase()} RISK DETECTED

Patient: ${patient.name} (Age ${patient.age})
Risk Factors: ${input.riskReasons.join('; ')}

${input.urgencyMessage}

Please check on ${patient.name.split(' ')[0]} immediately.
Emergency: 999 | Hospital: 03-2615-5555
- CareSphere AI Monitoring System`;

  const alertRecord: AlertRecord = {
    id: alertId,
    patientId: patient.id,
    patientName: patient.name,
    riskLevel: input.riskLevel,
    timestamp,
    status: 'pending',
    message,
    actions: [],
  };

  console.log(`[CAREGIVER ALERT] Sending to ${patient.caregiver.name} (${patient.caregiver.phone})`);
  console.log(`[CAREGIVER ALERT] Message: ${message}`);

  // In production: integrate with Twilio/Firebase Cloud Messaging/SendGrid
  // For demo: simulating successful delivery
  await new Promise((r) => setTimeout(r, 100));

  return {
    success: true,
    alertId,
    caregiverName: patient.caregiver.name,
    caregiverContact: patient.caregiver.phone,
    messageSent: message,
    channel: 'SMS + Email',
    timestamp,
  };
}
