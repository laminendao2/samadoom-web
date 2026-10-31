'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

const SURAH_NAMES: Record<number, string> = {
  1:'Al-Fatiha',2:'Al-Baqara',3:'Ali Imran',4:'An-Nisa',5:'Al-Maida',
  6:'Al-Anam',7:'Al-Araf',8:'Al-Anfal',9:'At-Tawba',10:'Yunus',
  11:'Hud',12:'Yusuf',13:'Ar-Rad',14:'Ibrahim',15:'Al-Hijr',
  16:'An-Nahl',17:'Al-Isra',18:'Al-Kahf',19:'Maryam',20:'Ta-Ha',
  21:'Al-Anbiya',22:'Al-Hajj',23:'Al-Muminun',24:'An-Nur',25:'Al-Furqan',
  26:'Ash-Shuara',27:'An-Naml',28:'Al-Qasas',29:'Al-Ankabut',30:'Ar-Rum',
  31:'Luqman',32:'As-Sajda',33:'Al-Ahzab',34:'Saba',35:'Fatir',
  36:'Ya-Sin',37:'As-Saffat',38:'Sad',39:'Az-Zumar',40:'Ghafir',
  41:'Fussilat',42:'Ash-Shura',43:'Az-Zukhruf',44:'Ad-Dukhan',45:'Al-Jathiya',
  46:'Al-Ahqaf',47:'Muhammad',48:'Al-Fath',49:'Al-Hujurat',50:'Qaf',
  51:'Adh-Dhariyat',52:'At-Tur',53:'An-Najm',54:'Al-Qamar',55:'Ar-Rahman',
  56:'Al-Waqia',57:'Al-Hadid',58:'Al-Mujadila',59:'Al-Hashr',60:'Al-Mumtahana',
  61:'As-Saf',62:'Al-Jumuah',63:'Al-Munafiqun',64:'At-Taghabun',65:'At-Talaq',
  66:'At-Tahrim',67:'Al-Mulk',68:'Al-Qalam',69:'Al-Haqqa',70:'Al-Maarij',
  71:'Nuh',72:'Al-Jinn',73:'Al-Muzzammil',74:'Al-Muddaththir',75:'Al-Qiyama',
  76:'Al-Insan',77:'Al-Mursalat',78:'An-Naba',79:'An-Naziat',80:'Abasa',
  81:'At-Takwir',82:'Al-Infitar',83:'Al-Mutaffifin',84:'Al-Inshiqaq',85:'Al-Buruj',
  86:'At-Tariq',87:'Al-Ala',88:'Al-Ghashiya',89:'Al-Fajr',90:'Al-Balad',
  91:'Ash-Shams',92:'Al-Layl',93:'Ad-Duha',94:'Ash-Sharh',95:'At-Tin',
  96:'Al-Alaq',97:'Al-Qadr',98:'Al-Bayyina',99:'Az-Zalzala',100:'Al-Adiyat',
  101:'Al-Qaria',102:'At-Takathur',103:'Al-Asr',104:'Al-Humaza',105:'Al-Fil',
  106:'Quraysh',107:'Al-Maun',108:'Al-Kawthar',109:'Al-Kafirun',110:'An-Nasr',
  111:'Al-Masad',112:'Al-Ikhlas',113:'Al-Falaq',114:'An-Nas',
};

const SURAH_VERSE_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

interface SurahProgress { versesRead?: number; completed?: boolean; versesDone?: Record<string, boolean> }

function calcProgress(coranProgress?: Record<string, SurahProgress>) {
  if (!coranProgress) return { done: 0, total: 6236, pct: 0, surahs: [] };
  let totalDone = 0;
  const surahs: { num: number; done: number; total: number; pct: number }[] = [];
  for (let i = 1; i <= 114; i++) {
    const total = SURAH_VERSE_COUNTS[i - 1] || 0;
    // La clé dans Firestore est le numéro de sourate directement (ex: "1", "2", ...)
    const data = coranProgress[String(i)];
    let done = 0;
    if (data) {
      if (data.completed) {
        done = total;
      } else if (data.versesDone) {
        done = Object.values(data.versesDone).filter(Boolean).length;
        done = Math.min(done, total);
      } else if (typeof data.versesRead === 'number') {
        done = Math.min(data.versesRead, total);
      }
    }
    totalDone += done;
    if (done > 0) surahs.push({ num: i, done, total, pct: Math.round((done / total) * 100) });
  }
  return { done: totalDone, total: 6236, pct: Math.round((totalDone / 6236) * 100), surahs };
}

export default function ProgresPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<ReturnType<typeof calcProgress> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'eleve') { router.push('/dashboard'); return; }
    getDoc(doc(db, 'users', profile.uid)).then((snap) => {
      if (snap.exists()) {
        setProgress(calcProgress(snap.data().coranProgress));
      } else {
        setProgress(calcProgress());
      }
      setLoading(false);
    });
  }, [profile, router]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin text-4xl">⏳</div></div>;
  if (!progress) return null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Mes progrès</h1>
        <p className="text-gray-500 text-sm mt-1">Suivi de ta mémorisation du Coran</p>
      </div>

      {/* Global stats */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-blue-200 text-sm">Versets mémorisés</p>
            <p className="text-4xl font-black">{progress.done.toLocaleString()}</p>
            <p className="text-blue-200 text-sm">sur 6 236 versets</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black">{progress.pct}%</p>
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
          <div className="bg-white rounded-full h-3 transition-all" style={{ width: `${progress.pct}%` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-black text-blue-600">{progress.surahs.length}</p>
          <p className="text-xs text-gray-500 mt-1">Sourates commencées</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-black text-green-600">{progress.surahs.filter(s => s.pct === 100).length}</p>
          <p className="text-xs text-gray-500 mt-1">Sourates complètes</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
          <p className="text-2xl font-black text-purple-600">{114 - progress.surahs.length}</p>
          <p className="text-xs text-gray-500 mt-1">Sourates restantes</p>
        </div>
      </div>

      {/* Surah detail */}
      {progress.surahs.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">📖</p>
          <p className="text-gray-500">Aucun progrès enregistré pour l&apos;instant.</p>
          <p className="text-gray-400 text-sm mt-1">Continue ta mémorisation dans l&apos;application mobile.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Détail par sourate</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {progress.surahs.sort((a, b) => a.num - b.num).map((s) => (
              <div key={s.num} className="px-4 py-3 flex items-center gap-4">
                <span className="text-xs text-gray-400 w-6 text-right font-mono">{s.num}</span>
                <span className="text-sm font-medium text-gray-800 w-32 truncate">{SURAH_NAMES[s.num]}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${s.pct === 100 ? 'bg-green-500' : s.pct >= 50 ? 'bg-blue-500' : 'bg-blue-300'}`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{s.done}/{s.total}</span>
                <span className={`text-xs font-bold w-10 text-right ${s.pct === 100 ? 'text-green-600' : 'text-blue-600'}`}>{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
