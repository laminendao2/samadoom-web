'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const ROLES = [
  { key: 'eleve', label: 'Élève', subtitle: 'Notes, devoirs & emploi du temps', emoji: '🎓', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  { key: 'parent', label: 'Parent', subtitle: 'Suivez la scolarité de votre enfant', emoji: '👨‍👩‍👧', color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8' },
  { key: 'professeur', label: 'Professeur', subtitle: 'Gérez vos classes et évaluations', emoji: '📋', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  { key: 'admin', label: 'Admin', subtitle: "Administration de l'établissement", emoji: '⚙️', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
];

const FEATURES = [
  { icon: '🛡️', title: 'Sécurité des données', desc: 'Vos informations sont protégées et confidentielles.' },
  { icon: '📱', title: 'Accessible partout', desc: 'Sur ordinateur, tablette et téléphone.' },
  { icon: '👥', title: 'Une communauté engagée', desc: 'Élèves, parents, professeurs et administrateurs.' },
  { icon: '🚀', title: 'Une meilleure réussite', desc: 'Parce que chaque élève mérite de réussir.' },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
          <p style={{ color: '#6B7280' }}>Chargement…</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, Arial, sans-serif' }}>
      {/* NAV */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#0D3320,#1a5c38)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📖</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#0D3320', letterSpacing: 1 }}>SAMA DOOM</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: -2 }}>La réussite scolaire, ensemble</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Accueil', 'À propos', 'Fonctionnalités', 'Contact'].map((item, i) => (
              <a key={item} href="#" style={{ color: i === 0 ? '#1D4ED8' : '#374151', textDecoration: i === 0 ? 'underline' : 'none', fontWeight: i === 0 ? 600 : 400, fontSize: 14 }}>{item}</a>
            ))}
          </div>
          <Link href="/login" style={{ background: '#1D4ED8', color: '#fff', padding: '8px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Se connecter</Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg,#0D3320 0%,#1a5c38 60%,#2d7a4f 100%)', minHeight: 420, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 2, padding: '60px 64px', maxWidth: 560 }}>
          <div style={{ display: 'inline-block', background: 'rgba(201,168,76,.2)', border: '1px solid rgba(201,168,76,.4)', borderRadius: 20, padding: '4px 16px', marginBottom: 20 }}>
            <span style={{ color: '#C9A84C', fontSize: 13, fontWeight: 600 }}>⭐ Éducation • Partage • Réussite</span>
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1.1, margin: '0 0 12px' }}>
            SAMA <span style={{ color: '#C9A84C' }}>DOOM</span>
          </h1>
          <p style={{ fontSize: 22, fontWeight: 600, color: '#e2e8f0', margin: '0 0 16px' }}>La réussite scolaire, ensemble</p>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.75)', lineHeight: 1.7, margin: '0 0 32px', maxWidth: 420 }}>
            Une plateforme complète pour accompagner les élèves, les parents, les enseignants et toute la communauté éducative.
          </p>
          <Link href="/login" style={{ background: '#1D4ED8', color: '#fff', padding: '14px 32px', borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            → Découvrir la plateforme
          </Link>
        </div>
        <div style={{ position: 'absolute', right: 80, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: 'rgba(255,255,255,.35)', lineHeight: 1.8, textAlign: 'right', fontStyle: 'italic' }}>
            Grandir<br/>Apprendre<br/>Réussir
          </div>
          <div style={{ width: 80, height: 3, background: '#C9A84C', marginTop: 8, marginLeft: 'auto', borderRadius: 2 }}></div>
        </div>
      </div>

      {/* ROLES */}
      <div style={{ background: '#fff', padding: '60px 64px' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 4, background: '#1D4ED8', borderRadius: 2 }}></div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', margin: 0 }}>Choisissez votre espace</h2>
          </div>
          <p style={{ color: '#6B7280', fontSize: 15, margin: 0 }}>Accédez à votre espace personnalisé selon votre profil.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {ROLES.map(role => (
            <Link key={role.key} href={`/login?role=${role.key}`} style={{ textDecoration: 'none', background: role.bg, border: `1px solid ${role.border}`, borderRadius: 16, padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, transition: 'transform .2s', cursor: 'pointer' }}>
              <div style={{ width: 64, height: 64, background: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>{role.emoji}</div>
              <div style={{ fontWeight: 800, color: role.color, fontSize: 15 }}>{role.label}</div>
              <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 1.5 }}>{role.subtitle}</div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: role.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, marginTop: 4 }}>→</div>
            </Link>
          ))}
          <Link href="/login?role=musulman" style={{ textDecoration: 'none', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ width: 64, height: 64, background: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>🕌</div>
            <div style={{ fontWeight: 800, color: '#D97706', fontSize: 15 }}>Espace Musulman(e)</div>
            <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 1.5 }}>Prières · Coran · Qibla · Douas · Calendrier</div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, marginTop: 4 }}>→</div>
          </Link>
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ background: '#f8fafc', padding: '48px 64px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>{f.icon}</div>
            <div>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: 14, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <footer style={{ background: '#1e293b', padding: '32px 64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📖</div>
          <div>
            <div style={{ fontWeight: 800, color: '#fff', fontSize: 14 }}>SAMA DOOM</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>La réussite scolaire, ensemble</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Accueil', 'À propos', 'Fonctionnalités', 'Contact'].map(item => (
            <a key={item} href="#" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13 }}>{item}</a>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>© 2025 SAMA DOOM. Tous droits réservés.</div>
      </footer>
    </div>
  );
}
