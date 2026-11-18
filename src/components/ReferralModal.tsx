'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ReferralModal() {
  const { user, profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [code, setCode]       = useState('');
  const [status, setStatus]   = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referrerName, setReferrerName] = useState('');
  const [submitting, setSubmitting]     = useState(false);

  // Afficher le modal si : connecté + pas de referredBy + pas déjà ignoré
  useEffect(() => {
    if (!user || !profile) return;
    if ((profile as any).referredBy) return; // déjà parrainé
    const key = `referral_skipped_${user.uid}`;
    if (localStorage.getItem(key)) return;    // déjà ignoré
    // Afficher seulement pour les comptes récents (< 7 jours)
    const createdAt = (profile as any).createdAt as Date | null;
    if (createdAt) {
      const age = Date.now() - createdAt.getTime();
      if (age > 7 * 24 * 60 * 60 * 1000) return; // compte trop vieux
    }
    // Délai léger pour laisser la page se charger
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [user, profile]);

  const dismiss = () => {
    if (user) localStorage.setItem(`referral_skipped_${user.uid}`, '1');
    setVisible(false);
  };

  const validate = async (val: string) => {
    const trimmed = val.trim().toUpperCase();
    setCode(trimmed);
    if (trimmed.length < 4) { setStatus('idle'); setReferrerName(''); return; }
    setStatus('checking');
    try {
      const res  = await fetch(`/api/referral/validate?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.valid) { setStatus('valid'); setReferrerName(data.referrerName || ''); }
      else             { setStatus('invalid'); setReferrerName(''); }
    } catch {
      setStatus('invalid'); setReferrerName('');
    }
  };

  const submit = async () => {
    if (status !== 'valid' || !user) return;
    setSubmitting(true);
    try {
      const idToken = await user.getIdToken();
      await fetch('/api/referral/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ code }),
      });
    } catch {/* non bloquant */}
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
        {/* Icône */}
        <div className="text-center mb-4">
          <span className="text-5xl">🤝</span>
        </div>

        <h2 className="text-xl font-bold text-gray-800 text-center mb-1">
          Code de parrainage ?
        </h2>
        <p className="text-sm text-gray-500 text-center mb-5">
          Un ami vous a recommandé Sama Doom ?<br />
          Entrez son code pour qu'il bénéficie de vos avantages.
        </p>

        {/* Input */}
        <div className="relative mb-2">
          <input
            type="text"
            placeholder="Ex : LAMIN7"
            value={code}
            onChange={e => validate(e.target.value)}
            maxLength={12}
            className={`w-full border-2 rounded-xl px-4 py-3 text-center text-lg font-mono uppercase tracking-widest outline-none transition-colors ${
              status === 'valid'   ? 'border-green-500 bg-green-50 text-green-700' :
              status === 'invalid' ? 'border-red-400 bg-red-50 text-red-600'       :
              'border-gray-200 focus:border-green-400'
            }`}
          />
          {status === 'checking' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Feedback */}
        <div className="h-5 text-center text-sm mb-4">
          {status === 'valid'   && <span className="text-green-600">✓ Code valide — parrain : <strong>{referrerName}</strong></span>}
          {status === 'invalid' && <span className="text-red-500">✗ Code introuvable</span>}
        </div>

        {/* Boutons */}
        <button
          onClick={submit}
          disabled={status !== 'valid' || submitting}
          className="w-full py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition mb-3"
        >
          {submitting ? 'Enregistrement…' : 'Valider le code'}
        </button>

        <button
          onClick={dismiss}
          className="w-full py-2 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition"
        >
          Je n'ai pas de code — continuer sans
        </button>
      </div>
    </div>
  );
}
