'use client';
import { useEffect, useState } from 'react';
import {
  collection, getDocs, query, where, doc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface UserRow {
  uid: string;
  name: string;
  email: string;
  role: string;
  ecoleId?: string;
  groupeId?: string;
  status?: string;
  createdAt?: Timestamp;
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  eleve:      { label: '🎓 Élève',      color: '#2563eb', bg: '#eff6ff' },
  parent:     { label: '👨‍👩‍👧 Parent',     color: '#db2777', bg: '#fdf2f8' },
  professeur: { label: '📋 Professeur', color: '#d97706', bg: '#fffbeb' },
  admin:      { label: '⚙️ Admin',      color: '#16a34a', bg: '#f0fdf4' },
};

const TABS = ['Tous', 'Élèves', 'Parents', 'Professeurs', 'Admins'];
const TAB_ROLES: Record<string, string | null> = {
  Tous: null, Élèves: 'eleve', Parents: 'parent', Professeurs: 'professeur', Admins: 'admin',
};

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Tous');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');

  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'superadmin' ||
    (profile?.roles ?? []).some(r => r === 'admin' || r === 'superadmin');

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { router.replace('/dashboard'); return; }
    if (!profile.ecoleId) { setLoading(false); return; }
    loadUsers();
  }, [profile]);

  async function loadUsers() {
    if (!profile?.ecoleId) return;
    setLoading(true);
    const snap = await getDocs(
      query(collection(db, 'users'), where('ecoleId', '==', profile.ecoleId))
    );
    setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() }) as UserRow));
    setLoading(false);
  }

  const filtered = users.filter(u => {
    const roleMatch = TAB_ROLES[tab] ? u.role === TAB_ROLES[tab] : true;
    const searchMatch = search.trim()
      ? u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
      : true;
    return roleMatch && searchMatch;
  });

  const counts = {
    Tous: users.length,
    Élèves: users.filter(u => u.role === 'eleve').length,
    Parents: users.filter(u => u.role === 'parent').length,
    Professeurs: users.filter(u => u.role === 'professeur').length,
    Admins: users.filter(u => u.role === 'admin').length,
  };

  if (!isAdmin) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Membres de l'école</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} membre{users.length > 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={loadUsers}
          className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
          🔄 Actualiser
        </button>
      </div>

      {!profile?.ecoleId ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-semibold text-orange-800">Votre compte n'est pas lié à une école</p>
          <p className="text-sm text-orange-600 mt-1">Contactez un Super Administrateur pour être assigné à une école.</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t} <span className="text-xs opacity-60">({counts[t as keyof typeof counts]})</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Rechercher par nom ou email…"
              className="w-full max-w-sm bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
            />
          </div>

          {/* List */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-gray-400">
                <div className="text-4xl mb-3 animate-pulse">👥</div>
                <p>Chargement…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <div className="text-4xl mb-3">🔍</div>
                <p>Aucun résultat</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Membre</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rôle</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Groupe</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(u => {
                      const rl = ROLE_LABELS[u.role];
                      const joinDate = u.createdAt instanceof Timestamp
                        ? u.createdAt.toDate().toLocaleDateString('fr-FR')
                        : '—';
                      return (
                        <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-800">
                                {(u.name || u.email || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{u.name || '—'}</p>
                                <p className="text-gray-400 text-xs">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {rl ? (
                              <span style={{ color: rl.color, background: rl.bg }}
                                className="px-2.5 py-1 rounded-full text-xs font-semibold">
                                {rl.label}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">{u.role}</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-gray-500 text-xs">
                            {u.groupeId ? `#${u.groupeId.slice(0, 8)}` : '—'}
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-xs">{joinDate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl text-sm font-medium shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
