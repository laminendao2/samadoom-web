'use client';
import { useEffect, useState, useRef } from 'react';
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs, arrayRemove, arrayUnion,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Ecole {
  id: string;
  nom: string;
  adminUid: string;
  coAdmins: string[];
  logoEcole?: string;
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isAdmin =
    profile?.role === 'admin' || profile?.role === 'superadmin' ||
    (profile?.roles ?? []).some(r => r === 'admin' || r === 'superadmin');

  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) { router.replace('/dashboard'); return; }
    loadEcole();
  }, [profile]);

  async function loadEcole() {
    if (!profile?.uid) return;
    setLoading(true);

    let snap = profile.ecoleId
      ? await getDoc(doc(db, 'ecoles', profile.ecoleId))
      : null;

    if (!snap?.exists()) {
      const q = await getDocs(query(collection(db, 'ecoles'), where('adminUid', '==', profile.uid)));
      if (!q.empty) snap = q.docs[0] as any;
    }

    if (!snap?.exists()) {
      const q2 = await getDocs(query(collection(db, 'ecoles'), where('coAdmins', 'array-contains', profile.uid)));
      if (!q2.empty) snap = q2.docs[0] as any;
    }

    if (!snap?.exists()) { setLoading(false); return; }
    const data = { id: snap.id, ...snap.data() } as Ecole;
    setEcole(data);
    setEditNom(data.nom);

    const uids = [data.adminUid, ...(data.coAdmins || [])].filter(Boolean);
    if (uids.length) {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('__name__', 'in', uids)));
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

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !ecole) return;
    if (file.size > 2 * 1024 * 1024) { showToast('❌ Image trop lourde (max 2 Mo)'); return; }
    setUploadingLogo(true);
    try {
      const storageRef = ref(storage, `ecoles/${ecole.id}/logo`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'ecoles', ecole.id), { logoEcole: url });
      setEcole(e => e ? { ...e, logoEcole: url } : e);
      showToast('✅ Logo mis à jour');
    } catch {
      showToast('❌ Erreur lors de l\'upload');
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = '';
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
        <p className="text-gray-500 text-sm mt-1">Paramètres et gestion de l&apos;établissement</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="text-5xl mb-4 animate-pulse">🏫</div><p>Chargement…</p>
        </div>
      ) : !ecole ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-semibold text-orange-800">Vous n&apos;êtes pas lié à une école</p>
          <p className="text-sm text-orange-600 mt-1">Contactez un Super Administrateur.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Logo + Infos générales */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">🏫 Informations générales</h2>

            {/* Logo */}
            <div className="flex items-center gap-5 mb-5 pb-5 border-b border-gray-50">
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0">
                {ecole.logoEcole ? (
                  <Image src={ecole.logoEcole} alt="Logo école" fill className="object-cover" />
                ) : (
                  <span className="text-3xl">🏫</span>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Logo de l&apos;école</p>
                <p className="text-xs text-gray-400 mb-3">JPG, PNG ou WebP · Max 2 Mo</p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="px-4 py-2 bg-gray-100 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {uploadingLogo ? 'Upload…' : ecole.logoEcole ? '🔄 Changer le logo' : '📷 Ajouter un logo'}
                </button>
              </div>
            </div>

            {/* Nom */}
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
                    <p className="text-xs text-gray-400 mb-0.5">Nom de l&apos;école</p>
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
              <p className="text-sm text-gray-400 mb-4">Aucun co-admin pour l&apos;instant</p>
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
              {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
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
            <p className="text-xs text-gray-400 mb-1">ID de l&apos;école (référence interne)</p>
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
