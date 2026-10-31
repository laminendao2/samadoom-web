'use client';
import { useEffect, useState } from 'react';
import {
  collection, getDocs, query, where, doc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const SURAH_NAMES: Record<number, string> = {
  1:'Al-Fatiha',2:'Al-Baqara',3:'Al-Imran',4:'An-Nisa',5:'Al-Ma\'ida',
  6:'Al-An\'am',7:'Al-A\'raf',8:'Al-Anfal',9:'At-Tawba',10:'Yunus',
  // ... simplified for brevity
};

const SURAH_VERSE_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,54,59,37,35,38,29,
  65,248,36,89,26,110,37,35,23,17,47,29,19,166,73,20,52,44,28,31,52,60,
  34,23,17,48,135,52,82,228,84,54,31,44,14,28,38,28,28,20,55,40,13,54,
  38,28,18,90,60,8,8,65,52,21,28,82,54,19,90,115,203,7,8,36,7,8,25,22,28,
  36,21,9,54,12,44,57,57,34,31,34,56,27,29,21,53,30,34,22,78,18,27,3,15,
  51,13,66,7,9,14,12,30,23,17,25,6,6,6,11,
];

interface Enfant {
  uid: string;
  name: string;
  email: string;
  role: string;
  ecoleId?: string;
  coranProgress?: Record<string, { versesRead?: number; completed?: boolean; versesDone?: Record<string, boolean> }>;
}

interface SurahProgress {
  num: number;
  name: string;
  done: number;
  total: number;
  pct: number;
}

function calcSurahProgress(coranProgress?: Record<string, { versesRead?: number; completed?: boolean; versesDone?: Record<string, boolean> }>): SurahProgress[] {
  if (!coranProgress) return [];
  const result: SurahProgress[] = [];
  for (let i = 1; i <= 114; i++) {
    const data = coranProgress[String(i)];
    if (!data) continue;
    const total = SURAH_VERSE_COUNTS[i - 1] || 0;
    let done = 0;
    if (data.completed) {
      done = total;
    } else if (data.versesDone) {
      done = Math.min(Object.values(data.versesDone).filter(Boolean).length, total);
    } else if (typeof data.versesRead === 'number') {
      done = Math.min(data.versesRead, total);
    }
    if (done > 0) result.push({ num: i, name: SURAH_NAMES[i] || `Sourate ${i}`, done, total, pct: total ? Math.round((done / total) * 100) : 0 });
  }
  return result.sort((a, b) => a.num - b.num);
}

function calcTotal(coranProgress?: Record<string, { versesRead?: number; completed?: boolean; versesDone?: Record<string, boolean> }>) {
  if (!coranProgress) return { done: 0, pct: 0 };
  let done = 0;
  for (let i = 1; i <= 114; i++) {
    const data = coranProgress[String(i)];
    if (!data) continue;
    const total = SURAH_VERSE_COUNTS[i - 1] || 0;
    if (data.completed) { done += total; }
    else if (data.versesDone) { done += Math.min(Object.values(data.versesDone).filter(Boolean).length, total); }
    else if (typeof data.versesRead === 'number') { done += Math.min(data.versesRead, total); }
  }
  return { done, pct: Math.round((done / 6236) * 100) };
}

export default function ParentEnfantsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [enfants, setEnfants] = useState<Enfant[]>([]);
  const [selected, setSelected] = useState<Enfant | null>(null);
  const [loading, setLoading] = useState(true);

  const isParent =
    profile?.role === 'parent' || profile?.role === 'superadmin' ||
    (profile?.roles ?? []).includes('parent');

  useEffect(() => {
    if (!profile) return;
    if (!isParent) { router.replace('/dashboard'); return; }
    loadEnfants();
  }, [profile]);

  async function loadEnfants() {
    if (!profile?.uid) return;
    setLoading(true);
    const snap = await getDocs(
      query(collection(db, 'users'), where('parents', 'array-contains', profile.uid))
    );
    const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }) as Enfant);
    setEnfants(data);
    if (data.length > 0) setSelected(data[0]);
    setLoading(false);
  }

  if (!isParent) return null;

  const surahProgress = selected ? calcSurahProgress(selected.coranProgress) : [];
  const total = selected ? calcTotal(selected.coranProgress) : { done: 0, pct: 0 };
  const activeSurahs = surahProgress.filter(s => s.done > 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Mes enfants</h1>
        <p className="text-gray-500 text-sm mt-1">Suivi de la progression Coran</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="text-5xl mb-4 animate-pulse">👨‍👩‍👧</div><p>Chargement…</p>
        </div>
      ) : enfants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <div className="text-5xl mb-4">👶</div>
          <p className="font-semibold">Aucun enfant lié à votre compte</p>
          <p className="text-sm mt-2 text-gray-400 max-w-xs mx-auto">
            Demandez à l'administrateur de votre école de lier votre compte à celui de votre enfant.
          </p>
        </div>
      ) : (
        <>
          {/* Child selector */}
          {enfants.length > 1 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {enfants.map(e => (
                <button key={e.uid} onClick={() => setSelected(e)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                    selected?.uid === e.uid
                      ? 'bg-purple-700 text-white shadow'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300'
                  }`}>
                  <span>{(e.name || e.email || '?')[0].toUpperCase()}</span>
                  {e.name || e.email}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <>
              {/* Child header */}
              <div className="bg-gradient-to-r from-purple-800 to-purple-600 rounded-2xl p-6 text-white mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-black">
                      {(selected.name || selected.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-black">{selected.name}</h2>
                      <p className="text-purple-200 text-sm">{selected.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-yellow-300">{total.pct}%</div>
                    <p className="text-purple-200 text-xs mt-1">{total.done.toLocaleString()} / 6 236 versets</p>
                  </div>
                </div>
                {/* Global progress bar */}
                <div className="mt-4 bg-white/20 rounded-full h-3">
                  <div className="h-3 rounded-full bg-yellow-400 transition-all"
                    style={{ width: `${total.pct}%` }}
                  />
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Sourates commencées', value: activeSurahs.length, icon: '📖', color: '#7c3aed' },
                  { label: 'Versets mémorisés', value: total.done.toLocaleString(), icon: '✅', color: '#16a34a' },
                  { label: 'Complétion globale', value: `${total.pct}%`, icon: '⭐', color: '#d97706' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.color + '10', borderColor: s.color + '20' }}
                    className="bg-white rounded-2xl border p-4 text-center">
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div style={{ color: s.color }} className="text-xl font-black">{s.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Surahs */}
              {activeSurahs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
                  <div className="text-4xl mb-3">📖</div>
                  <p>Aucun verset mémorisé pour l'instant</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-50">
                    <h3 className="font-bold text-gray-900">Progression par sourate</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {activeSurahs.map(s => (
                      <div key={s.num} className="px-6 py-4 flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                          {s.num}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {s.done}/{s.total} versets
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all"
                              style={{
                                width: `${s.pct}%`,
                                background: s.pct === 100 ? '#16a34a' : s.pct >= 50 ? '#7c3aed' : '#9ca3af',
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex-shrink-0 w-12 text-right">
                          <span className={`text-sm font-bold ${s.pct === 100 ? 'text-green-600' : s.pct >= 50 ? 'text-purple-600' : 'text-gray-500'}`}>
                            {s.pct}%
                          </span>
                        </div>
                        {s.pct === 100 && <span className="text-lg">✅</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
