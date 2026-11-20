import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Même région que PayDunya — évite les blocages Cloudflare WAF depuis les régions US
export const preferredRegion = 'cdg1';

const GEMINI_MODEL    = 'gemini-1.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Rate limiting en mémoire (reset au redémarrage Vercel) ───────────────────
// Pour une protection plus robuste, utiliser Upstash Redis
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 30; // par utilisateur

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(uid);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(uid, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_MINUTE) return false;
  entry.count++;
  return true;
}

// ── Nettoyage mémoire (évite fuite mémoire) ──────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(uid);
  }
}, 5 * 60_000);

export async function POST(req: NextRequest) {
  try {
    // 1) Auth Firebase obligatoire
    // Accepte le token depuis Authorization OU X-Firebase-Token (fallback si Cloudflare WAF strip Authorization)
    const rawAuth = req.headers.get('Authorization');
    const customToken = req.headers.get('X-Firebase-Token') || req.headers.get('x-firebase-token');
    const authHeader = rawAuth ?? (customToken ? `Bearer ${customToken}` : null);
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);
    let uid: string;
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    // 2) Rate limiting : max 10 messages/minute par utilisateur
    if (!checkRateLimit(uid)) {
      return NextResponse.json(
        { error: 'Trop de messages. Attends une minute.' },
        { status: 429 }
      );
    }

    // 3) Validation du body
    const body = await req.json();
    // Accepte "message" (mobile) ou "userText" (web) pour compatibilité
    const { history, userText: _ut, message: _msg, systemPrompt, lang } = body;
    const userText: string = (_msg ?? _ut ?? '');

    if (!userText || typeof userText !== 'string' || userText.trim().length === 0) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 });
    }
    if (userText.length > 1000) {
      return NextResponse.json({ error: 'Message trop long (max 1000 caractères)' }, { status: 400 });
    }
    if (!Array.isArray(history) || history.length > 20) {
      return NextResponse.json({ error: 'Historique invalide' }, { status: 400 });
    }

    // 4) Clé Gemini depuis variable d'environnement (jamais exposée au client)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Service IA non configuré' }, { status: 503 });
    }

    // 5) Construction du payload Gemini
    const contents: { role: string; parts: { text: string }[] }[] = [];
    const safeHistory = Array.isArray(history) ? history.slice(-10) : []; // max 10 échanges

    if (safeHistory.length === 0) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userText }] });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + (safeHistory[0]?.text ?? userText) }],
      });
      for (let i = 1; i < safeHistory.length; i++) {
        const msg = safeHistory[i];
        if (msg?.role && msg?.text) {
          contents.push({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: [{ text: String(msg.text).slice(0, 2000) }],
          });
        }
      }
      contents.push({ role: 'user', parts: [{ text: userText }] });
    }

    // 6) Appel Gemini — clé en query param (compatible AQ. et AIzaSy...)
    const geminiUrl = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.7,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      return NextResponse.json({ error: 'Erreur IA (' + geminiRes.status + ')' }, { status: 502 });
    }

    const data = await geminiRes.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '…';

    // 7) Log usage (optionnel, pour stats) — fire and forget
    try {
      await adminDb.collection('aiUsage').add({
        uid,
        lang: lang ?? 'fr',
        inputLen: userText.length,
        outputLen: reply.length,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch { /* non bloquant */ }

    // Retourne "text" (mobile) ET "reply" (web) pour compatibilité
    return NextResponse.json({ text: reply, reply });

  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
