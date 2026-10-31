'use client';
import { useEffect, useState } from 'react';
import {
  collection, getDocs, query, where, doc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const SURAH_VERSE_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,54,59,37,35,38,29,
  65,248,36,89,26,110,37,35,23,17,47,29,19,166,73,20,52,44,28,31,52,60,
  34,23,17,48,135,52,82,228,84,54,31,44,14,28,38,28,28,20,55,40,13,54,
  38,28,18,90,60,8,8,65,52,21,28,82,54,19,90,115,203,7,8,36,7,8,25,22,28,
  36,21,9,54,12,44,57,57,34,31,34,56,27,29,21,53,30,34,22,78,18,27,3,15,
  51,13,66,7,9,14,12,30,23,17,25,6,6,6,11,
];

interface Groupe {
  id: string;
  nom: string;
  code: string;
  profUid: string;
  membres: string[];
}
interface EleveRow {
  uid: string;
  name: string;
  email: string;
  coranProgress?: Record<string, unknown>;
}

type CoranProg = Record<string, { versesRead?: number; completed?: boolean; versesDone?: Record<string, boolean> }>;

function calcProgress(coranProgress?: CoranProg) {
  if (!coranProgress) return { done: 0, total: 6236, pct: 0 };
  let done = 0;
  for (let i = 1; i <= 114; i++) {
    const data = coranProgress[String(i)];
    if (!data) continue;
    const total = SURAH_VERSE_COUNTS[i - 1] || 0;
    if (data.completed) { done += total; }
    else if (data.versesDone) { done += Math.min(Object.values(data.versesDone).filter(Boolean).length, total); }
    else if (typeof data.versesRead === 'number') { done += Math.min(data.versesRead, total); }
  }
  return { done, total: 6236, pct: Math.round((done / 6236) * 100) };
}

export default function ProfElevesPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [selectedGroupe, setSelectedGroupe] = useState<Groupe | null>(null);
  const [eleves, setEleves] = useState<EleveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEleves, setLoadingEleves] = useState(false);
  const [search, setSearch] = useState('');

  const isProf =
    profile?.role === 'professeur' || profile?.role === 'admin' || profile?.role === 'superadmin' ||
    (profile?.roles ?? []).some(r => r === 'professeur' || r === 'admin' || r === 'superadmin');

  useEffect(() => {
    if (!profile) return;
    if (!isProf) { router.replace('/dashboard'); return; }
    loadGroupes();
  }, [profile]);

  async function loadGroupes() {
    if (!profile?.uid) return;
    setLoading(true);
    const snap = await getDocs(
      query(collection(db, 'groupes'), where('profUid', '==', profile.uid))
    );
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Groupe);
    setGroupes(data);
    if (data.length > 0) {
      setSelectedGroupe(data[0]);
      loadEleves(data[0]);
    }
    setLoading(false);
  }

  async function loadEleves(groupe: Groupe) {
    setLoadingEleves(true);
    setEleves([]);
    if (!groupe.membres?.length) { setLoadingEleves(false); return; }
    const rows: EleveRow[] = [];
    for (const uid of groupe.membres) {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) rows.push({ uid: snap.id, ...snap.data() } as EleveRow);
    }
    setEleves(rows);
    setLoadingEleves(false);
  }

  function selectGroupe(g: Groupe) {
    setSelectedGroupe(g);
    setSearch('');
    loadEleves(g);
  }

  const filtered = search.trim()
    ? eleves.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()))
    : eleves;

  if (!isProf) return null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Mes élèves</h1>
        <p className="text-gray-500 text-sm mt-1">Progressions Coran par halaqa</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="text-5xl mb-4 animate-pulse">🎓</div><p>Chargement…</p>
        </div>
      ) : groupes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <div className="text-5xl mb-4">📚</div>
          <p className="font-semibold">Vous n'avez pas encore de halaqa</p>
          <p className="text-sm mt-1">Créez-en une depuis l'application mobile</p>
        </div>
      ) : (
        <>
          {/* Groupe selector */}
          {groupes.length > 1 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {groupes.map(g => (
                <button key={g.id} onClick={() => selectGroupe(g)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    selectedGroupe?.id === g.id
                      ? 'bg-orange-600 text-white shadow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300'
                  }`}>
                  🕌 {g.nom}
                  <span className="ml-2 opacity-60 text-xs">({g.membres?.length || 0})</span>
                </button>
              ))}
            </div>
          )}

          {selectedGroupe && (
            <>
              {/* Halaqa header */}
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-6 text-white mb-6 flex items-center justify-between">
                <div>
                  <p className="text-orange-200 text-xs font-medium mb-1">Halaqa</p>
                  <h2 className="text-xl font-black">{selectedGroupe.nom}</h2>
                  <p className="text-orange-200 text-sm mt-1">
                    {selectedGroupe.membres?.length || 0} élève{(selectedGroupe.membres?.length || 0) > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-orange-200 text-xs mb-1">Code d'accès</p>
                  <p className="font-mono text-2xl font-black tracking-widest">{selectedGroupe.code}</p>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍  Rechercher un élève…"
                  className="w-full max-w-sm bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {loadingEleves ? (
                  <div className="py-16 text-center text-gray-400">
                    <div className="text-4xl mb-3 animate-pulse">📖</div><p>Chargement des élèves…</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-gray-400">
                    <div className="text-4xl mb-3">🎓</div>
                    <p>{search ? 'Aucun résultat' : 'Aucun élève dans cette halaqa'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Élève</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Versets mémorisés</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">Progression</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filtered
                          .map(e => ({ ...e, prog: calcProgress(e.coranProgress as CoranProg) }))
                          .sort((a, b) => b.prog.pct - a.prog.pct)
                          .map(e => (
                            <tr key={e.uid} className="hover:bg-orange-50/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700">
                                    {(e.name || e.email || '?')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">{e.name || '—'}</p>
                                    <p className="text-gray-400 text-xs">{e.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className="font-semibold text-gray-800">{e.prog.done.toLocaleString()}</span>
                                <span className="text-gray-400"> / {e.prog.total.toLocaleString()}</span>
                              </td>
                              <td className="px-4 py-4 w-48">
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full transition-all"
                                    style={{
                                      width: `${e.prog.pct}%`,
                                      background: e.prog.pct >= 50 ? '#16a34a' : e.prog.pct >= 20 ? '#d97706' : '#6b7280',
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`font-bold ${e.prog.pct >= 50 ? 'text-green-600' : e.prog.pct >= 20 ? 'text-orange-600' : 'text-gray-500'}`}>
                                  {e.prog.pct}%
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
