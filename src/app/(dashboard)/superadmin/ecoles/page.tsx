'use client';
import { useEffect, useState } from 'react';
import {
  collection, getDocs, addDoc, serverTimestamp, query, where, Timestamp,
  updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Ecole {
  id: string;
  nom: string;
  adminUid: string;
  coAdmins?: string[];
  createdAt?: Timestamp;
  status?: 'active' | 'inactive';
}
interface AdminInfo {
  uid: string;
  name: string;
  email: string;
}

export default function SuperAdminEcolesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [ecoles, setEcoles] = useState<Ecole[]>([]);
  const [admins, setAdmins] = useState<Record<string, AdminInfo>>({});
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: '', adminEmail: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // ecole.id
  const [actionLoading, setActionLoading] = useState<string | null>(null); // ecole.id

  const isSuperAdmin =
    profile?.role === 'superadmin' || (profile?.roles ?? []).includes('superadmin');

  useEffect(() => {
    if (!profile) return;
    if (!isSuperAdmin) { router.replace('/dashboard'); return; }
    loadAll();
  }, [profile]);

  async function loadAll() {
    setLoading(true);
    const [ecolesSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'ecoles')),
      getDocs(collection(db, 'users')),
    ]);
    const ecolesData = ecolesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Ecole);
    setEcoles(ecolesData);

    const usersData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminInfo & { ecoleId?: string }));
    const adminMap: Record<string, AdminInfo> = {};
    const countMap: Record<string, number> = {};
    usersData.forEach(u => {
      adminMap[u.uid] = { uid: u.uid, name: (u as any).name || '', email: (u as any).email || '' };
      if ((u as any).ecoleId) {
        countMap[(u as any).ecoleId] = (countMap[(u as any).ecoleId] || 0) + 1;
      }
    });
    setAdmins(adminMap);
    setUserCounts(countMap);
    setLoading(false);
  }

  async function handleCreate() {
    setError('');
    if (!form.nom.trim()) { setError('Nom de l\'école requis'); return; }
    setSaving(true);
    try {
      // Find admin by email
      const usersSnap = await getDocs(query(collection(db, 'users'), where('email', '==', form.adminEmail.trim())));
      if (usersSnap.empty && form.adminEmail.trim()) {
        setError('Aucun utilisateur trouvé avec cet email');
        setSaving(false);
        return;
      }
      const adminUid = usersSnap.empty ? '' : usersSnap.docs[0].id;
      await addDoc(collection(db, 'ecoles'), {
        nom: form.nom.trim(),
        adminUid,
        coAdmins: [],
        createdAt: serverTimestamp(),
      });
      setForm({ nom: '', adminEmail: '' });
      setShowForm(false);
      showToast(`✅ École "${form.nom}" créée`);
      loadAll();
    } catch (e) {
      setError('Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function toggleStatus(ecole: Ecole) {
    const newStatus = ecole.status === 'inactive' ? 'active' : 'inactive';
    setActionLoading(ecole.id);
    try {
      await updateDoc(doc(db, 'ecoles', ecole.id), { status: newStatus });
      setEcoles(prev => prev.map(e => e.id === ecole.id ? { ...e, status: newStatus } : e));
      showToast(newStatus === 'inactive' ? `⏸️ "${ecole.nom}" désactivée` : `✅ "${ecole.nom}" réactivée`);
    } catch {
      showToast('❌ Erreur lors de la mise à jour');
    }
    setActionLoading(null);
  }

  async function handleDelete(ecoleId: string, ecoleNom: string) {
    setActionLoading(ecoleId);
    try {
      await deleteDoc(doc(db, 'ecoles', ecoleId));
      setEcoles(prev => prev.filter(e => e.id !== ecoleId));
      setConfirmDelete(null);
      showToast(`🗑️ "${ecoleNom}" supprimée`);
    } catch {
      showToast('❌ Erreur lors de la suppression');
    }
    setActionLoading(null);
  }

  if (!isSuperAdmin) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Toutes les écoles</h1>
          <p className="text-gray-500 text-sm mt-1">{ecoles.length} école{ecoles.length > 1 ? 's' : ''} enregistrée{ecoles.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="px-5 py-2.5 bg-green-700 text-white rounded-xl text-sm font-bold hover:bg-green-800 transition-colors">
          + Nouvelle école
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-green-200 p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">Créer une nouvelle école</h3>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nom de l'école *</label>
              <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Ex: Daara Al-Iman"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email de l'admin principal</label>
              <input value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                placeholder="admin@example.com"
                type="email"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={handleCreate} disabled={saving}
              className="px-5 py-2.5 bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-green-800 transition-colors">
              {saving ? 'Création…' : 'Créer l\'école'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="text-5xl mb-4 animate-pulse">🏫</div>
          <p>Chargement…</p>
        </div>
      ) : ecoles.length === 0 ? (
        <div className="py-20 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <div className="text-5xl mb-4">🏫</div>
          <p className="font-semibold">Aucune école enregistrée</p>
          <p className="text-sm mt-1">Cliquez sur "Nouvelle école" pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ecoles.map(ecole => {
            const admin = admins[ecole.adminUid];
            const count = userCounts[ecole.id] || 0;
            const created = ecole.createdAt instanceof Timestamp
              ? ecole.createdAt.toDate().toLocaleDateString('fr-FR')
              : '—';
            return (
              <div key={ecole.id} className={`bg-white rounded-2xl border p-6 hover:shadow-sm transition-all ${ecole.status === 'inactive' ? 'border-orange-200 opacity-70' : 'border-gray-100'}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${ecole.status === 'inactive' ? 'bg-orange-100' : 'bg-green-100'}`}>
                    {ecole.status === 'inactive' ? '⏸️' : '🏫'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900 truncate">{ecole.nom}</h3>
                      {ecole.status === 'inactive' && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">Désactivée</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Créée le {created}</p>
                    {admin && (
                      <p className="text-xs text-gray-600 mt-2">
                        <span className="font-semibold">Admin :</span> {admin.name || admin.email}
                      </p>
                    )}
                    {!ecole.adminUid && (
                      <p className="text-xs text-orange-500 mt-2">⚠️ Aucun admin assigné</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-4 text-xs text-gray-500">
                  <span>👥 <strong className="text-gray-700">{count}</strong> membre{count > 1 ? 's' : ''}</span>
                  <span>👤 <strong className="text-gray-700">{ecole.coAdmins?.length || 0}</strong> co-admin{(ecole.coAdmins?.length || 0) > 1 ? 's' : ''}</span>
                </div>
                {/* Actions SuperAdmin */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => toggleStatus(ecole)}
                    disabled={actionLoading === ecole.id}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${
                      ecole.status === 'inactive'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`}
                  >
                    {actionLoading === ecole.id ? '…' : ecole.status === 'inactive' ? '▶️ Réactiver' : '⏸️ Désactiver'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(ecole.id)}
                    disabled={actionLoading === ecole.id}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    🗑️ Supprimer
                  </button>
                </div>

                {/* Confirmation suppression */}
                {confirmDelete === ecole.id && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-xs font-semibold text-red-700 mb-2">
                      ⚠️ Supprimer définitivement &quot;{ecole.nom}&quot; ? Cette action est irréversible.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(ecole.id, ecole.nom)}
                        disabled={actionLoading === ecole.id}
                        className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                      >
                        {actionLoading === ecole.id ? 'Suppression…' : 'Oui, supprimer'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-2xl text-sm font-medium shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
