import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? '';
  // Vercel stocke parfois la clé avec des guillemets ou des \n échappés — on nettoie les deux
  const privateKey = rawKey
    .replace(/^["']|["']$/g, '')   // supprime les guillemets englobants éventuels
    .replace(/\\n/g, '\n');        // convertit les \n littéraux en vrais sauts de ligne

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !clientEmail || !privateKey) {
    console.error('[firebase-admin] Variables manquantes:', { projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey });
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
