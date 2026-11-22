import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { isSuperAdminUid, verifyRequestUser } from '@/lib/server-auth';

/**
 * GET /api/superadmin/referral-filleuls?code=COUMBA4718
 * Retourne la liste des utilisateurs qui ont savedReferralCode === code
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await verifyRequestUser(req);
    if (!authUser) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    if (!(await isSuperAdminUid(authUser.uid))) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.json({ error: 'Code manquant' }, { status: 400 });

    const snap = await adminDb
      .collection('users')
      .where('savedReferralCode', '==', code.toUpperCase())
      .get();

    const filleuls = snap.docs.map(doc => {
      const d = doc.data();
      return {
        uid: doc.id,
        name: d.name ?? d.displayName ?? '—',
        email: d.email ?? '—',
        isPro: !!(d.isPro),
        subscriptionEnd: d.subscriptionEnd ? (typeof d.subscriptionEnd.toDate === 'function' ? d.subscriptionEnd.toDate().toISOString() : String(d.subscriptionEnd)) : null,
        createdAt: d.createdAt ? (typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate().toISOString() : String(d.createdAt)) : null,
      };
    });

    // Trier par date création (plus récent en premier)
    filleuls.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    return NextResponse.json({ code: code.toUpperCase(), filleuls });
  } catch (err) {
    console.error('referral-filleuls error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
