import { NextRequest } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/** Vérifie le Firebase ID token du header Authorization. Retourne null si absent ou invalide. */
export async function verifyRequestUser(req: NextRequest): Promise<DecodedIdToken | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const idToken = header.slice(7).trim();
  if (!idToken) return null;
  try {
    return await adminAuth.verifyIdToken(idToken);
  } catch {
    return null;
  }
}

export async function isSuperAdminUid(uid: string): Promise<boolean> {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) return false;
  const data = snap.data()!;
  return data.role === 'superadmin' ||
    (Array.isArray(data.roles) && data.roles.includes('superadmin'));
}
