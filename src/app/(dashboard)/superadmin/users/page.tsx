'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  collection, getDocs, doc, updateDoc, Timestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface UserRow {
  uid: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  isPro?: boolean;
  subscriptionEnd?: Timestamp | string;
  ecoleId?: string;
  createdAt?: Timestamp | string;
}

function tsToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof ts === 'string') return new Date(ts);
  return null;
}
function isPro(u: UserRow): boolean {
  const d = tsToDate(u.subscriptionEnd);
  return d ? d > new Date() : false;
}

const ROLE_LABELS: Record<string, string> = {
  eleve: '🎓 Élève', parent: '👨‍👩‍👧 Parent', professeur: '📋 Prof',
  admin: '⚙️ Admin', superadmin: '🔴 SuperAdmin',
};
const ROLE_COLORS: Record<string, string> = {
  eleve: '#2563eb', parent: '#db2777', professeur: '#d97706',
  admin: '#16a34a', superadmin: '#dc2626',
};

export default function SuperAdminUsersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filtered, setFiltered] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [proFilter, setProFilter] = useState('all');
  const [modal, setModal] = useState<{ user: UserRow; mode: 'grant' | 'revoke' } | null>(null);
  const [grantDate, setGrantDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const isSuperAdmin =
    profile?.role === 'superadmin' || (profile?.roles ?? []).includes('superadmin');

  useEffect(() => {
    if (!profile) return;
    if (!isSuperAdmin) { router.replace('/dashboard'); return; }
    loadUsers();
  }, [profile]);

  async function loadUsers() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }) as UserRow);
    setUsers(rows);
    setFiltered(rows);
    setLoading(false);
  }

  useEffect(() => {
    let r = users;
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(u => u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s));
    }
    if (roleFilter !== 'all') r = r.filter(u => u.role === roleFilter);
    if (proFilter === 'pro') r = r.filter(u => isPro(u));
    if (proFilter === 'free') r = r.filter(u => !isPro(u));
    setFiltered(r);
  }, [search, roleFilter, proFilter, users]);

  async function handleGrant() {
    if (!modal || !grantDate) return;
    setSaving(true);
    const end = new Date(grantDate);
    end.setHours(23, 59, 59);
    await updateDoc(doc(db, 'users', modal.user.uid), {
      subscriptionEnd: Timestamp.fromDate(end),
    });
    showToast(`✅ Abonnement accordé à ${modal.user.name || modal.user.email} jusqu'au ${end.toLocaleDateString('fr-FR')}`);
    setModal(null);
    setSaving(false);
    loadUsers();
  }

  async function handleRevoke() {
    if (!modal) return;
    setSaving(true);
    await updateDoc(doc(db, 'users', modal.user.uid), { subscriptionEnd: null });
    showToast(`Abonnement révoqué pour ${modal.user.name || modal.user.email}`);
    setModal(null);
    setSaving(false);
    loadUsers();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Tous les utilisateurs</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} / {users.length} utilisateurs</p>
        </div>
        <button onClick={loadUsers}
          className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
          🔄 Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex flex-wrap gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Rechercher par nom ou email…"
          className="flex-1 min-w-48 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
          <option value="all">Tous les rôles</option>
          <option value="eleve">Élèves</option>
          <option value="parent">Parents</option>
          <option value="professeur">Professeurs</option>
          <option value="admin">Admins</option>
          <option value="superadmin">SuperAdmins</option>
        </select>
        <select value={proFilter} onChange={e => setProFilter(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none">
          <option value="all">Tous (Pro + Free)</option>
          <option value="pro">Pro uniquement ⭐</option>
          <option value="free">Free uniquement</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <div className="text-4xl mb-3 animate-pulse">👥</div>
            <p>Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p>Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilisateur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rôle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abonnement</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Inscription</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(u => {
                  const pro = isPro(u);
                  const endDate = tsToDate(u.subscriptionEnd);
                  const joinDate = tsToDate(u.createdAt);
                  return (
                    <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center font-bold text-red-700">
                            {(u.name || u.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{u.name || '—'}</p>
                            <p className="text-gray-400 text-xs">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span style={{ color: ROLE_COLORS[u.role] || '#6b7280', background: (ROLE_COLORS[u.role] || '#6b7280') + '15' }}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold">
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {pro ? (
                          <div>
                            <span className="bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full text-xs font-bold">⭐ Pro</span>
                            {endDate && (
                              <p className="text-xs text-gray-400 mt-1">
                                jusqu'au {endDate.toLocaleDateString('fr-FR')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full text-xs font-semibold">Free</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-xs">
                        {joinDate ? joinDate.toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setModal({ user: u, mode: 'grant' }); setGrantDate(''); }}
                            className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition-colors">
                            ⭐ Abonner
                          </button>
                          {pro && (
                            <button
                              onClick={() => setModal({ user: u, mode: 'revoke' })}
                              className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors">
                              ✕ Révoquer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {modal.mode === 'grant' ? (
              <>
                <h3 className="text-lg font-black text-gray-900 mb-1">Accorder un abonnement Pro</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Pour <span className="font-semibold text-gray-800">{modal.user.name || modal.user.email}</span>
                </p>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date de fin d'abonnement</label>
                <input type="date" value={grantDate} onChange={e => setGrantDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 mb-6"
                />
                <div className="flex gap-3">
                  <button onClick={() => setModal(null)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Annuler
                  </button>
                  <button onClick={handleGrant} disabled={!grantDate || saving}
                    className="flex-1 py-3 rounded-xl bg-green-700 text-white text-sm font-bold disabled:opacity-50 hover:bg-green-800 transition-colors">
                    {saving ? 'Enregistrement…' : '✓ Confirmer'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-black text-gray-900 mb-1">Révoquer l'abonnement</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Voulez-vous vraiment révoquer l'abonnement Pro de{' '}
                  <span className="font-semibold text-gray-800">{modal.user.name || modal.user.email}</span> ?
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setModal(null)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Annuler
                  </button>
                  <button onClick={handleRevoke} disabled={saving}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-50 hover:bg-red-700 transition-colors">
                    {saving ? 'Révocation…' : '✕ Révoquer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl text-sm font-medium shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
