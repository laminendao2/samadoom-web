'use client';
import { useEffect, useState } from 'react';
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs, arrayRemove, arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Ecole {
  id: string;
  nom: string;
  adminUid: string;
  coAdmins: string[];
}
interface UserInfo { uid: string; name: string; email: string; }

export default function AdminEcolePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [ecole, setEcole] = useState<Ecole | null>(null);
  const [adminInfo, setAdminInfo] = useState<UserInfo | null>(null);
  const [coAdminInfos, setCoAdminInfos] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editNom, setEditNom] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addingCo, setAddingCo] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'superadmin' ||
    (profile?.roles ?? []).some(r => r === 'admin' || r === 'superadmin');

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { router.replace('/dashboard'); return; }
    if (!profile.ecoleId) { setLoading(false); return; }
    loadEcole();
  }, [profile]);

  async function loadEcole() {
    if (!profile?.ecoleId) return;
    setLoading(true);
    const snap = await getDoc(doc(db, 'ecoles', profile.ecoleId));
    if (!snap.exists()) { setLoading(false); return; }
    const data = { id: snap.id, ...snap.data() } as Ecole;
    setEcole(data);
    setEditNom(data.nom);

    const uids = [data.adminUid, ...(data.coAdmins || [])].filter(Boolean);
    if (uids.length) {
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('__name__', 'in', uids))
      );
      const map: Record<string, UserInfo> = {};
      usersSnap.docs.forEach(d => { map[d.id] = { uid: d.id, ...d.data() } as UserInfo; });
      setAdminInfo(map[data.adminUid] || null);
      setCoAdminInfos((data.coAdmins || []).map(uid => map[uid]).filter(Boolean));
    }
    setLoading(false);
  }

  async function saveNom() {
    if (!ecole || !editNom.trim()) return;
    setSaving(true);
    await updateDoc(doc(db, 'ecoles', ecole.id), { nom: editNom.trim() });
    setEcole(e => e ? { ...e, nom: editNom.trim() } : e);
    setEditing(false);
    setSaving(false);
    showToast('✅ Nom mis à jour');
  }

  async function addCoAdmin() {
    if (!ecole || !addEmail.trim()) return;
    setError(''); setAddingCo(true);
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', addEmail.trim())));
    if (snap.empty) { setError('Aucun utilisateur avec cet email'); setAddingCo(false); return; }
    const uid = snap.docs[0].id;
    if (ecole.coAdmins?.includes(uid) || uid === ecole.adminUid) {
      setError('Cet utilisateur est déjà admin'); setAddingCo(false); return;
    }
    await updateDoc(doc(db, 'ecoles', ecole.id), { coAdmins: arrayUnion(uid) });
    setAddEmail('');
    setAddingCo(false);
    showToast('✅ Co-admin ajouté');
    loadEcole();
  }

  async function removeCoAdmin(uid: string) {
    if (!ecole) return;
    await updateDoc(doc(db, 'ecoles', ecole.id), { coAdmins: arrayRemove(uid) });
    showToast('Co-admin retiré');
    loadEcole();
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000);
  }

  if (!isAdmin) return null;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Mon école</h1>
        <p className="text-gray-500 text-sm mt-1">Paramètres et gestion de l'établissement</p>
      </div>

      {!profile?.ecoleId ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-semibold text-orange-800">Vous n'êtes pas lié à une école</p>
          <p className="text-sm text-orange-600 mt-1">Contactez un Super Administrateur.</p>
        </div>
      ) : loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="text-5xl mb-4 animate-pulse">🏫</div><p>Chargement…</p>
        </div>
      ) : !ecole ? (
        <div className="py-20 text-center text-gray-400">École introuvable.</div>
      ) : (
        <div className="space-y-6">
          {/* Nom */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">🏫 Informations générales</h2>
            <div className="flex items-center gap-3">
              {editing ? (
                <>
                  <input value={editNom} onChange={e => setEditNom(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                  />
                  <button onClick={saveNom} disabled={saving}
                    className="px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                    {saving ? '…' : '✓ Sauvegarder'}
                  </button>
                  <button onClick={() => { setEditing(false); setEditNom(ecole.nom); }}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-0.5">Nom de l'école</p>
                    <p className="font-bold text-gray-900 text-lg">{ecole.nom}</p>
                  </div>
                  <button onClick={() => setEditing(true)}
                    className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
                    ✏️ Modifier
                  </button>
                </>
              )}
            </div>
            {adminInfo && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1">Admin principal</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-800 font-bold text-sm">
                    {(adminInfo.name || adminInfo.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{adminInfo.name}</p>
                    <p className="text-xs text-gray-400">{adminInfo.email}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Co-admins */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4">👥 Co-administrateurs</h2>
            {coAdminInfos.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Aucun co-admin pour l'instant</p>
            ) : (
              <div className="space-y-3 mb-4">
                {coAdminInfos.map(co => (
                  <div key={co.uid} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center font-bold text-green-800 text-sm">
                      {(co.name || co.email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{co.name}</p>
                      <p className="text-xs text-gray-400 truncate">{co.email}</p>
                    </div>
                    <button onClick={() => removeCoAdmin(co.uid)}
                      className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors flex-shrink-0">
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-gray-50 pt-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Ajouter un co-admin par email</p>
              {error && (
                <p className="text-xs text-red-500 mb-2">{error}</p>
              )}
              <div className="flex gap-2">
                <input value={addEmail} onChange={e => setAddEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCoAdmin()}
                  placeholder="email@example.com" type="email"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                />
                <button onClick={addCoAdmin} disabled={addingCo || !addEmail.trim()}
                  className="px-4 py-2.5 bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-green-800 transition-colors">
                  {addingCo ? '…' : '+ Ajouter'}
                </button>
              </div>
            </div>
          </div>

          {/* ID */}
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">ID de l'école (référence interne)</p>
            <p className="font-mono text-xs text-gray-600 break-all">{ecole.id}</p>
          </div>
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
