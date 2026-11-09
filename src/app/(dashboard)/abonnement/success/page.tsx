'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const plan = searchParams.get('plan') || 'mensuel';
  const token = searchParams.get('token');

  const [verifyStatus, setVerifyStatus] = useState<'loading' | 'activated' | 'pending' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token || !user) {
      setVerifyStatus('activated');
      return;
    }

    const verify = async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/paydunya/verify-and-activate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (data.status === 'activated' || data.status === 'already_activated') {
          setVerifyStatus('activated');
        } else if (data.status === 'pending') {
          setVerifyStatus('pending');
        } else {
          setVerifyStatus('error');
          setErrorMsg(data.message || 'Erreur de vérification');
        }
      } catch {
        setVerifyStatus('error');
        setErrorMsg('Impossible de vérifier le paiement');
      }
    };

    verify();
  }, [token, user]);

  useEffect(() => {
    if (verifyStatus === 'activated') {
      const t = setTimeout(() => router.push('/dashboard'), 5000);
      return () => clearTimeout(t);
    }
  }, [verifyStatus, router]);

  if (verifyStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#166534', marginBottom: 8 }}>Vérification du paiement…</h1>
          <p style={{ color: '#374151' }}>Activation de votre abonnement en cours…</p>
        </div>
      </div>
    );
  }

  if (verifyStatus === 'pending') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fffbeb', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Paiement en attente</h1>
          <p style={{ color: '#374151', marginBottom: 24, lineHeight: 1.6 }}>
            Votre paiement est en cours de traitement. L&apos;abonnement sera activé automatiquement dès confirmation.
            <br /><br />Si le problème persiste, contactez le support.
          </p>
          <Link href="/abonnement" style={{ display: 'block', padding: '12px 0', background: '#d97706', color: 'white', borderRadius: 12, fontWeight: 700, textDecoration: 'none' }}>
            Retour à l&apos;abonnement
          </Link>
        </div>
      </div>
    );
  }

  if (verifyStatus === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>Erreur de vérification</h1>
          <p style={{ color: '#374151', marginBottom: 24 }}>{errorMsg}</p>
          <Link href="/abonnement" style={{ display: 'block', padding: '12px 0', background: '#dc2626', color: 'white', borderRadius: 12, fontWeight: 700, textDecoration: 'none' }}>
            Retour à l&apos;abonnement
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#166534', marginBottom: 8 }}>Paiement réussi !</h1>
        <p style={{ color: '#374151', marginBottom: 24, lineHeight: 1.6 }}>
          Votre abonnement <strong>{plan === 'annuel' ? 'Annuel' : 'Mensuel'}</strong> est maintenant actif.
          <br />Profitez de tout le contenu Sama Doom.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280, margin: '0 auto' }}>
          <Link href="/dashboard" style={{
            display: 'block', padding: '14px 0', background: '#166534', color: 'white',
            borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none',
          }}>
            Aller au tableau de bord
          </Link>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>Redirection automatique dans 5 secondes…</p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement…</div>}>
      <SuccessContent />
    </Suspense>
  );
}
