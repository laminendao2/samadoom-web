'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import Link from 'next/link';

function fmt(n: number) { return Math.round(n).toLocaleString('fr-FR'); }

interface Stats {
  totalEcoles: number;
  totalUsers: number;
  totalPro: number;
  totalProfs: number;
  totalEleves: number;
  totalAdmins: number;
  totalParents: number;
}

interface Payment {
  id: string;
  userEmail: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  provider?: string;
  createdAt: Timestamp | string;
}

interface PlatformStats {
  count: number;
  completed: number;
  pending: number;
  cancelled: number;
  totalNative: number;
  totalXof: number;
  currency: string;
  nativeLabel: string;
}

interface RcData {
  activeSubscriptions: number;
  mrrUsd: number | null;
  revenueUsd28d: number | null;
  mrrXof: number | null;
  revenueXof28d: number | null;
  apiConnected: boolean;
  error?: string;
}

interface FinanceStats {
  platforms: Record<string, PlatformStats>;
  revenueCat: RcData;
  commissions: { totalEarned: number; dues: number; paid: number };
  summary: { totalXof: number; netXof: number; totalPayments: number };
}

function tsToDate(ts: unknown): Date {
  if (!ts) return new Date(0);
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof ts === 'string') return new Date(ts);
  return new Date(0);
}

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryResult, setRetryResult] = useState<{ activated: number; already: number; cancelled: number; total: number } | null>(null);

  const isSuperAdmin =
    profile?.role === 'superadmin' || (profile?.roles ?? []).includes('superadmin');

  useEffect(() => {
    if (!profile) return;
    if (!isSuperAdmin) { router.replace('/dashboard'); return; }
    loadAll();
  }, [profile]);

  async function retryStripePayments() {
    setRetryLoading(true);
    setRetryResult(null);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/admin/retry-stripe-payments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      setRetryResult(data);
      // Recharger les paiements pour refléter les changements
      await loadAll();
    } catch {
      setRetryResult({ activated: 0, already: 0, cancelled: 0, total: 0 });
    } finally {
      setRetryLoading(false);
    }
  }

  async function loadAll() {
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const [ecolesSnap, usersSnap, paymentsSnap, finRes] = await Promise.all([
        getDocs(collection(db, 'ecoles')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'payments'), limit(10))),
        fetch('/api/admin/finance-stats', { headers: { Authorization: `Bearer ${idToken}` } }).then(r => r.json()),
      ]);
      const now = new Date();
      const users = usersSnap.docs.map(d => d.data());
      setStats({
        totalEcoles: ecolesSnap.size,
        totalUsers: users.length,
        totalPro: users.filter(u => {
          if (u.isPro === true) return true;
          if (u.planExpiresAt && new Date(u.planExpiresAt) > now) return true;
          if (tsToDate(u.subscriptionEnd) > now) return true;
          return false;
        }).length,
        totalProfs: users.filter(u => u.role === 'professeur').length,
        totalEleves: users.filter(u => u.role === 'eleve').length,
        totalAdmins: users.filter(u => u.role === 'admin').length,
        totalParents: users.filter(u => u.role === 'parent').length,
      });
      if (finRes && finRes.summary) setFinanceStats(finRes as FinanceStats);
      const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Payment);
      allPayments.sort((a, b) => tsToDate(b.createdAt).getTime() - tsToDate(a.createdAt).getTime());
      setRecentPayments(allPayments.slice(0, 10));
    } finally {
      setLoading(false);
    }
  }

  if (!isSuperAdmin) return null;

  const STAT_CARDS = stats ? [
    { label: 'Écoles', value: stats.totalEcoles, icon: '🏫', color: '#dc2626', bg: '#fef2f2' },
    { label: 'Utilisateurs', value: stats.totalUsers, icon: '👥', color: '#2563eb', bg: '#eff6ff' },
    { label: 'Abonnés Pro', value: stats.totalPro, icon: '⭐', color: '#d97706', bg: '#fffbeb' },
    { label: 'Professeurs', value: stats.totalProfs, icon: '🎓', color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Élèves', value: stats.totalEleves, icon: '📚', color: '#0891b2', bg: '#ecfeff' },
    { label: 'Parents', value: stats.totalParents, icon: '👨‍👩‍👧', color: '#db2777', bg: '#fdf2f8' },
  ] : [];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-800 to-red-600 rounded-2xl p-8 text-white mb-8">
        <p className="text-red-200 text-sm font-medium mb-1">Super Administrateur</p>
        <h1 className="text-3xl font-black">Vue Globale</h1>
        <p className="text-red-200 mt-1 text-sm">Toutes les écoles · Tous les utilisateurs</p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4 animate-pulse">⚙️</div>
          <p>Chargement des données…</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {STAT_CARDS.map(card => (
              <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.color}20` }}
                className="rounded-2xl p-5 text-center">
                <div className="text-3xl mb-2">{card.icon}</div>
                <div style={{ color: card.color }} className="text-2xl font-black">{card.value}</div>
                <div className="text-xs text-gray-500 mt-1 font-medium">{card.label}</div>
              </div>
            ))}
          </div>

          {/* ── FINANCES ─────────────────────────────────────────── */}
          {financeStats && (
            <div className="mb-8">
              <h2 className="text-lg font-black text-gray-800 mb-4">💰 Finances</h2>

              {/* Résumé top */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {[
                  { label: 'Total encaissé', value: `${fmt(financeStats.summary.totalXof)} FCFA`, icon: '📥', color: '#16a34a', bg: '#f0fdf4' },
                  { label: 'Commissions dues', value: `${fmt(financeStats.commissions.dues)} FCFA`, icon: '🤝', color: '#d97706', bg: '#fffbeb' },
                  { label: 'Commissions payées', value: `${fmt(financeStats.commissions.paid)} FCFA`, icon: '✅', color: '#6b7280', bg: '#f9fafb' },
                  { label: 'Net à encaisser', value: `${fmt(financeStats.summary.netXof)} FCFA`, icon: '🏦', color: '#2563eb', bg: '#eff6ff' },
                ].map(c => (
                  <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}20` }} className="rounded-2xl p-5">
                    <div className="text-2xl mb-1">{c.icon}</div>
                    <div style={{ color: c.color }} className="text-xl font-black">{c.value}</div>
                    <div className="text-xs text-gray-500 mt-1 font-medium">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* Tableau par plateforme */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Plateforme</th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Transactions</th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Payés</th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">En attente</th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Annulés</th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Montant natif</th>
                      <th className="text-right px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Équiv. FCFA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(financeStats.platforms).map(([key, pl]) => (
                      <tr key={key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{key === 'stripe' ? '💳' : key === 'paydunya' ? '📱' : '🔗'}</span>
                            <div>
                              <div className="font-bold text-gray-800 capitalize">{key === 'paydunya' ? 'PayDunya' : key === 'stripe' ? 'Stripe' : key}</div>
                              <div className="text-xs text-gray-400">{key === 'stripe' ? 'Carte bancaire internationale (EUR)' : key === 'paydunya' ? 'Mobile Money — Orange, Wave (FCFA)' : 'Autre'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-gray-700">{pl.count}</td>
                        <td className="px-5 py-4 text-right"><span className="text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full">{pl.completed}</span></td>
                        <td className="px-5 py-4 text-right"><span className="text-yellow-700 font-semibold">{pl.pending}</span></td>
                        <td className="px-5 py-4 text-right"><span className="text-red-500 font-semibold">{pl.cancelled}</span></td>
                        <td className="px-5 py-4 text-right font-bold text-gray-800">{pl.nativeLabel}</td>
                        <td className="px-5 py-4 text-right font-black text-green-700">{fmt(pl.totalXof)} FCFA</td>
                      </tr>
                    ))}
                    {/* RevenueCat (IAP) */}
                    <tr className="border-b border-gray-50 bg-purple-50/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📱</span>
                          <div>
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                              RevenueCat (Apple / Google)
                              {financeStats.revenueCat.apiConnected
                                ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">🟢 Connecté</span>
                                : <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">⚠️ Clé manquante</span>
                              }
                            </div>
                            <div className="text-xs text-gray-400">
                              {financeStats.revenueCat.apiConnected
                                ? `IAP App Store & Play Store · MRR $${financeStats.revenueCat.mrrUsd?.toFixed(2) ?? '—'} · 28j $${financeStats.revenueCat.revenueUsd28d?.toFixed(2) ?? '—'}`
                                : financeStats.revenueCat.error ?? 'IAP — abonnements App Store & Play Store'
                              }
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-gray-500">—</td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded-full text-xs">
                          {financeStats.revenueCat.activeSubscriptions} actifs
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-gray-400">—</td>
                      <td className="px-5 py-4 text-right text-gray-400">—</td>
                      <td className="px-5 py-4 text-right text-xs text-purple-700 font-bold">
                        {financeStats.revenueCat.mrrUsd !== null
                          ? `$${financeStats.revenueCat.mrrUsd.toFixed(2)}/mois`
                          : <a href="https://app.revenuecat.com" target="_blank" rel="noopener" className="text-purple-500 underline">dashboard</a>
                        }
                      </td>
                      <td className="px-5 py-4 text-right font-black text-purple-700">
                        {financeStats.revenueCat.mrrXof !== null
                          ? `~${fmt(financeStats.revenueCat.mrrXof)} FCFA/mois`
                          : <span className="text-gray-400 text-xs font-normal">Ajouter REVENUECAT_SECRET_KEY</span>
                        }
                      </td>
                    </tr>
                    {/* Total */}
                    <tr className="bg-gray-800 text-white">
                      <td className="px-5 py-4 font-black text-sm" colSpan={5}>TOTAL (Stripe + PayDunya)</td>
                      <td className="px-5 py-4 text-right text-xs text-gray-300">converti en FCFA</td>
                      <td className="px-5 py-4 text-right font-black text-green-400 text-base">{fmt(financeStats.summary.totalXof)} FCFA</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Commissions détail */}
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <div className="font-bold text-amber-800 mb-1">🤝 Commissions parrainage</div>
                  <div className="text-sm text-amber-700">
                    Total gagné par les parrains : <strong>{fmt(financeStats.commissions.totalEarned)} FCFA</strong> ·
                    Déjà versé : <strong>{fmt(financeStats.commissions.paid)} FCFA</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-amber-600 font-medium">Reste à payer</div>
                  <div className="text-2xl font-black text-amber-800">{fmt(financeStats.commissions.dues)} FCFA</div>
                </div>
              </div>

              {/* Net */}
              <div className="mt-3 bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-5 text-white flex items-center justify-between">
                <div>
                  <div className="text-blue-200 text-sm font-medium">Net estimé après commissions</div>
                  <div className="text-xs text-blue-300 mt-0.5">Total encaissé − commissions dues (RevenueCat non inclus)</div>
                </div>
                <div className="text-3xl font-black">{fmt(financeStats.summary.netXof)} FCFA</div>
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { href: '/superadmin/users', icon: '👥', title: 'Gérer les utilisateurs', desc: 'Rechercher, abonner, révoquer', color: '#2563eb' },
              { href: '/superadmin/ecoles', icon: '🏫', title: 'Gérer les écoles', desc: 'Créer, modifier, voir les stats', color: '#16a34a' },
              { href: '/abonnement', icon: '💳', title: 'Abonnements', desc: 'Voir les plans PayDunya', color: '#d97706' },
              { href: '/superadmin/referrals', icon: '🤝', title: 'Parrainage', desc: 'Commissions et filleuls', color: '#7c3aed' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-all flex items-start gap-4 no-underline">
                <div style={{ background: item.color + '15', color: item.color }}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p style={{ color: item.color }} className="font-bold text-sm">{item.title}</p>
                  <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Recent payments */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-bold text-gray-900">Paiements récents</h2>
              <div className="flex items-center gap-3 flex-wrap">
                {retryResult && (
                  <span className="text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-full">
                    ✅ {retryResult.activated} activés · ⏭ {retryResult.already} déjà actifs · ❌ {retryResult.cancelled} annulés
                  </span>
                )}
                <button
                  onClick={retryStripePayments}
                  disabled={retryLoading}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {retryLoading ? '⏳ Vérification…' : '🔄 Régulariser Stripe'}
                </button>
                <span className="text-xs text-gray-400">{recentPayments.length} derniers</span>
              </div>
            </div>
            {recentPayments.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">Aucun paiement enregistré</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentPayments.map(p => (
                  <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-lg">💳</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.userEmail}</p>
                        <p className="text-xs text-gray-400">
                          Plan {p.plan} · {p.currency} {p.amount?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        p.status === 'completed' ? 'bg-green-100 text-green-700' :
                        p.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                                                   'bg-red-100 text-red-600'
                      }`}>
                        {p.status === 'completed' ? '✓ Payé' : p.status === 'pending' ? '⏳ En attente' : '✗ Échoué'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {p.createdAt ? tsToDate(p.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
