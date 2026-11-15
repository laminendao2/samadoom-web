import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser } from '@/lib/server-auth';
import { activatePaydunyaPayment } from '@/lib/subscription';

/**
 * Route réservée au SuperAdmin : tente de confirmer tous les paiements PayDunya
 * qui sont restés en statut "pending" (IPN manqué ou page de succès sans token).
 */
export async function POST(req: NextRequest) {
  const authUser = await verifyRequestUser(req);
  if (!authUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  // Vérifier que c'est un SuperAdmin
  const userDoc = await adminDb.collection('users').doc(authUser.uid).get();
  const userData = userDoc.data();
  const isSuperAdmin = userData?.role === 'superadmin' || (Array.isArray(userData?.roles) && userData.roles.includes('superadmin'));
  if (!isSuperAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  // Récupérer tous les paiements pending PayDunya
  const snap = await adminDb.collection('payments')
    .where('status', '==', 'pending')
    .where('provider', '==', 'paydunya')
    .get();

  const results: { token: string; result: string }[] = [];

  for (const doc of snap.docs) {
    const token = doc.id;
    try {
      const outcome = await activatePaydunyaPayment(token);
      results.push({ token, result: outcome.result });
    } catch (err) {
      results.push({ token, result: `error: ${String(err)}` });
    }
    // Petite pause pour ne pas surcharger l'API PayDunya
    await new Promise(r => setTimeout(r, 200));
  }

  const activated = results.filter(r => r.result === 'activated').length;
  const already   = results.filter(r => r.result === 'already').length;
  const notPaid   = results.filter(r => r.result === 'not_paid').length;
  const errors    = results.filter(r => r.result.startsWith('error')).length;

  return NextResponse.json({
    total: results.length,
    activated,
    already,
    notPaid,
    errors,
    details: results,
  });
}
