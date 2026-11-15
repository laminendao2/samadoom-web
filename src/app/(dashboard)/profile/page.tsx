'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const COUNTRY_CODES = [
  { code: '+221', flag: '🇸🇳', label: 'Sénégal (+221)' },
  { code: '+225', flag: '🇨🇮', label: "Côte d'Ivoire (+225)" },
  { code: '+223', flag: '🇲🇱', label: 'Mali (+223)' },
  { code: '+226', flag: '🇧🇫', label: 'Burkina Faso (+226)' },
  { code: '+224', flag: '🇬🇳', label: 'Guinée (+224)' },
  { code: '+229', flag: '🇧🇯', label: 'Bénin (+229)' },
  { code: '+228', flag: '🇹🇬', label: 'Togo (+228)' },
  { code: '+222', flag: '🇲🇷', label: 'Mauritanie (+222)' },
  { code: '+33',  flag: '🇫🇷', label: 'France (+33)' },
  { code: '+1',   flag: '🇨🇦', label: 'Canada (+1)' },
];

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const [name, setName]           = useState(profile?.name || '');
  const [phone, setPhone]         = useState(profile?.phone || '');
  const [phoneCountry, setPhoneCountry] = useState(profile?.phoneCountry || '+221');
  const [saved, setSaved]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const handleSave = async () => {
    if (!user) return;
    // Validation numéro si renseigné
    if (phone) {
      const cleanPhone = phone.replace(/\s+/g, '');
      if (!/^\d{7,10}$/.test(cleanPhone)) {
        setPhoneError('Numéro invalide (7 à 10 chiffres sans indicatif)');
        return;
      }
    }
    setPhoneError('');
    setSaving(true);
    await updateDoc(doc(db, 'users', user.uid), {
      name,
      phone: phone.replace(/\s+/g, '') || null,
      phoneCountry: phone ? phoneCountry : null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
  };

  const openContact = () => {
    window.open('mailto:info@freejobla.com?subject=Support%20Sama%20Doom', '_blank');
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-black text-gray-900 mb-8">Mon profil</h1>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl font-black text-green-700">
            {(profile?.name || profile?.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{profile?.name || 'Sans nom'}</p>
            <p className="text-gray-500 text-sm">{profile?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full capitalize">
              {profile?.role}
            </span>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Nom complet</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-600 focus:outline-none text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            📱 Numéro Mobile Money
            <span className="ml-1 text-xs font-normal text-gray-400">(pour les retraits de parrainage)</span>
          </label>
          <div className="flex gap-2">
            <select
              value={phoneCountry}
              onChange={e => setPhoneCountry(e.target.value)}
              className="px-3 py-3 border-2 border-gray-200 rounded-xl focus:border-green-600 focus:outline-none text-gray-900 bg-white text-sm"
              style={{ minWidth: 170 }}>
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
              ))}
            </select>
            <input
              type="tel"
              placeholder="77 123 45 67"
              value={phone}
              onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-600 focus:outline-none text-gray-900"
            />
          </div>
          {phoneError && <p className="text-red-600 text-xs mt-1">{phoneError}</p>}
          <p className="text-xs text-gray-400 mt-1">Sans l&apos;indicatif pays · Sera utilisé pour vos retraits (non modifiable au moment du retrait)</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="mt-4 px-6 py-2.5 bg-green-700 text-white font-bold rounded-xl hover:bg-green-800 transition-colors disabled:opacity-60">
          {saved ? '✅ Sauvegardé !' : saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
      {['eleve', 'parent'].includes(profile?.role || '') && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
          <h2 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide text-gray-500">Abonnement</h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{profile?.isPro ? '⭐' : '🔓'}</span>
            <div>
              <p className="font-bold text-gray-900">{profile?.isPro ? 'Plan Pro actif' : 'Plan gratuit'}</p>
              <p className="text-sm text-gray-500">{profile?.isPro ? 'Accès complet à tout le contenu' : 'Passe à Pro pour tout débloquer'}</p>
            </div>
          </div>
          {profile?.isPro ? (
            <button className="w-full py-3 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-colors">
              ⚙️ Gérer / Annuler mon abonnement
            </button>
          ) : (
            <a href="/abonnement" className="block w-full py-3 bg-yellow-500 text-white font-bold rounded-xl hover:bg-yellow-600 transition-colors text-center">
              ✨ Passer à Pro
            </a>
          )}
        </div>
      )}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide text-gray-500">Support</h2>
        <button onClick={openContact}
          className="w-full py-3 bg-blue-700 text-white font-bold rounded-xl hover:bg-blue-800 transition-colors">
          ✉️ Nous contacter
        </button>
      </div>
    </div>
  );
}
