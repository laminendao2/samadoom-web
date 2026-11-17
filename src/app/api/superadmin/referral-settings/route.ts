import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyRequestUser, isSuperAdminUid } from '@/lib/server-auth';

export interface ReferralLevelSettings {
  requiresPro: boolean;   // le parrain de ce niveau doit-il être Pro pour toucher ?
  enabled: boolean;       // ce niveau est-il actif ?
  rate: number;           // taux de commission (lecture seule côté UI, géré dans subscription.ts)
}

export interface ReferralSettings {
  levels: [ReferralLevelSettings, ReferralLevelSettings, ReferralLevelSettings];
  updatedAt?: string;
  updatedBy?: string;
}

/** Valeurs par défaut */
export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  levels: [
    { requiresPro: false, enabled: true,  rate: 0.10  },
    { requiresPro: false, enabled: true,  rate: 0.035 },
    { requiresPro: false, enabled: true,  rate: 0.015 },
  ],
};

const CONFIG_REF = adminDb.collection('config').doc('referralSettings');

export async function GET(req: NextRequest) {
  const decoded = await verifyRequestUser(req);
  if (!decoded) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!(await isSuperAdminUid(decoded.uid))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const snap = await CONFIG_REF.get();
  const data = snap.exists ? snap.data() as ReferralSettings : DEFAULT_REFERRAL_SETTINGS;
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestUser(req);
  if (!decoded) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!(await isSuperAdminUid(decoded.uid))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as Partial<ReferralSettings>;

  // Valider la structure
  if (!Array.isArray(body.levels) || body.levels.length !== 3) {
    return NextResponse.json({ error: 'Structure invalide' }, { status: 400 });
  }
  for (const lvl of body.levels) {
    if (typeof lvl.requiresPro !== 'boolean' || typeof lvl.enabled !== 'boolean') {
      return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
    }
  }

  // Lire les taux actuels (non modifiables via l'UI)
  const existing = (await CONFIG_REF.get()).data() as ReferralSettings | undefined;
  const rates = existing?.levels.map(l => l.rate)
    ?? DEFAULT_REFERRAL_SETTINGS.levels.map(l => l.rate);

  const updated: ReferralSettings = {
    levels: body.levels.map((lvl, i) => ({
      requiresPro: lvl.requiresPro,
      enabled: lvl.enabled,
      rate: rates[i],
    })) as ReferralSettings['levels'],
    updatedAt: new Date().toISOString(),
    updatedBy: decoded.uid,
  };

  await CONFIG_REF.set(updated);
  return NextResponse.json({ ok: true, settings: updated });
}
