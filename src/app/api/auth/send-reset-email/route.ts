import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { getPasswordResetEmail } from '@/lib/emailTemplates';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    const resetLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://samadoom.com'}/login`,
    });

    const html = getPasswordResetEmail(resetLink);

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      // Fallback: return the link for development
      return NextResponse.json({ ok: true, dev: true });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sama Doom <noreply@samadoom.com>',
        to: [email],
        subject: 'Réinitialisez votre mot de passe – Sama Doom',
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    // User not found — still return ok to avoid user enumeration
    if (msg.includes('USER_NOT_FOUND') || msg.includes('user-not-found')) {
      return NextResponse.json({ ok: true });
    }
    console.error('send-reset-email error:', msg);
    // Message générique : ne pas exposer les détails internes
    return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 });
  }
}
