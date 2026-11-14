// Plans PayDunya (web) — source unique pour les montants et les durées.
// `amount` = prix réellement facturé (prix de lancement le cas échéant).
// `regularAmount` = prix de référence affiché barré.

export type PlanId = 'semaine' | 'mensuel' | 'annuel';

export interface PlanConfig {
  name: string;
  amount: number; // FCFA facturés
  regularAmount: number; // FCFA, prix normal (barré si > amount)
  description: string;
}

export const PAYDUNYA_PLANS: Record<PlanId, PlanConfig> = {
  semaine: {
    name: 'Abonnement Hebdomadaire',
    amount: 500, // prix de lancement (pas de prix barré défini)
    regularAmount: 500,
    description: 'Accès complet Sama Doom — 1 semaine (prix de lancement)',
  },
  mensuel: {
    name: 'Abonnement Mensuel',
    amount: 1500, // prix de lancement
    regularAmount: 3000,
    description: 'Accès complet Sama Doom — 1 mois (prix de lancement)',
  },
  annuel: {
    name: 'Abonnement Annuel',
    amount: 24000,
    regularAmount: 24000,
    description: 'Accès complet Sama Doom — 12 mois',
  },
};

export function isPlanId(plan: unknown): plan is PlanId {
  return typeof plan === 'string' && plan in PAYDUNYA_PLANS;
}

/** Date de fin d'abonnement pour un plan, à partir de `from` (défaut : maintenant). */
export function computePlanExpiry(plan: string, from: Date = new Date()): Date {
  const expiresAt = new Date(from);
  if (plan === 'semaine') {
    expiresAt.setDate(expiresAt.getDate() + 7);
  } else if (plan === 'annuel') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }
  return expiresAt;
}

export const PLAN_LABELS: Record<string, string> = {
  semaine: 'Hebdomadaire',
  mensuel: 'Mensuel',
  annuel: 'Annuel',
};
