'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  createdAt: Timestamp;
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
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin =
    profile?.role === 'superadmin' || (profile?.roles ?? []).includes('superadmin');

  useEffect(() => {
    if (!profile) return;
    if (!isSuperAdmin) { router.replace('/dashboard'); return; }
    loadAll();
  }, [profile]);

  async function loadAll() {
    try {
      const [ecolesSnap, usersSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, 'ecoles')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(10))),
      ]);
      const now = new Date();
      const users = usersSnap.docs.map(d => d.data());
      setStats({
        totalEcoles: ecolesSnap.size,
        totalUsers: users.length,
        totalPro: users.filter(u => tsToDate(u.subscriptionEnd) > now).length,
        totalProfs: users.filter(u => u.role === 'professeur').length,
        totalEleves: users.filter(u => u.role === 'eleve').length,
        totalAdmins: users.filter(u => u.role === 'admin').length,
        totalParents: users.filter(u => u.role === 'parent').length,
      });
      setRecentPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Payment));
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

          {/* Quick links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { href: '/superadmin/users', icon: '👥', title: 'Gérer les utilisateurs', desc: 'Rechercher, abonner, révoquer', color: '#2563eb' },
              { href: '/superadmin/ecoles', icon: '🏫', title: 'Gérer les écoles', desc: 'Créer, modifier, voir les stats', color: '#16a34a' },
              { href: '/abonnement', icon: '💳', title: 'Abonnements', desc: 'Voir les plans PayDunya', color: '#d97706' },
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
            <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Paiements récents</h2>
              <span className="text-xs text-gray-400">{recentPayments.length} derniers</span>
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
