'use client';
import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get('plan') || 'mensuel';

  useEffect(() => {
    // Rediriger vers le dashboard après 5s
    const t = setTimeout(() => router.push('/dashboard'), 5000);
    return () => clearTimeout(t);
  }, [router]);

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
