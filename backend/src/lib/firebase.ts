/**
 * Firebase Admin SDK initialisation.
 * On Cloud Run / GCP: uses Application Default Credentials automatically.
 * Locally: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *         OR run `gcloud auth application-default login`.
 * If Firestore is unavailable the app falls back to in-memory mode silently.
 */

import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
  db = admin.firestore();
  console.log('[Firebase] Firestore connected ✓');
} catch (err) {
  console.warn('[Firebase] Firestore unavailable — running in-memory only:', (err as Error).message);
}

export { db };
