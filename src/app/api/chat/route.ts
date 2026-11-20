import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Même région que PayDunya — évite les blocages Cloudflare WAF depuis les régions US
export const preferredRegion = 'cdg1';

const GEMINI_MODEL    = 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Rate limiting supprimé (en mémoire = non fiable sur Vercel serverless) ────
// Chaque instance Vercel a sa propre mémoire → les anciennes instances
// continuent à servir des requêtes après un redéploiement avec leur compteur plein.
// Protection assurée par : Firebase Auth (uid vérifié) + quotas Gemini API.

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

    // 2) [Rate limiting supprimé — non fiable sur Vercel serverless]
    // Les quotas Gemini API + Firebase Auth protègent la route.

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

    // 6) Appel Gemini avec retry automatique sur 429 (rate limit par minute)
    const geminiUrl = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
    const geminiPayload = JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: 1024,
        // temperature supprimé : paramètre déprécié dans Gemini 3.6 Flash → causait erreur 400
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      ],
    });

    let geminiRes: Response | null = null;
    // 3 tentatives : immédiat → +2s → +4s (utile si limite RPM atteinte momentanément)
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
      geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiPayload,
      });
      if (geminiRes.ok || geminiRes.status !== 429) break;
      const errPreview = await geminiRes.text();
      console.error(`Gemini error (attempt ${attempt + 1}/3):`, geminiRes.status, errPreview.slice(0, 300));
      // Clone la réponse pour relecture (fetch body ne peut être lu qu'une fois)
      geminiRes = new Response(errPreview, { status: geminiRes.status, headers: geminiRes.headers });
    }

    if (!geminiRes!.ok) {
      const errText = await geminiRes!.text();
      const geminiStatus = geminiRes!.status;
      console.error('Gemini error (final):', geminiStatus, errText.slice(0, 500));
      if (geminiStatus === 429) {
        // Status 429 sans body → vieux app construit "Erreur 429" → msg.includes('429') = true → "Attends"
        return NextResponse.json({}, { status: 429 });
      }
      // Erreurs Gemini spécifiques → messages différents pour diagnostiquer depuis l'app
      // 404 = modèle introuvable, 403 = clé API invalide/quota, 400 = requête invalide
      let errMsg = 'Service IA non configuré'; // vieux app: msg.includes('non configuré') → 🛠️
      if (geminiStatus === 404) errMsg = 'Service IA non configuré - modèle introuvable 404';
      else if (geminiStatus === 403) errMsg = 'Service IA non configuré - clé invalide 403';
      else if (geminiStatus === 400) errMsg = 'Service IA non configuré - requête invalide 400';
      return NextResponse.json({ error: errMsg }, { status: 503 });
    }

    const data = await geminiRes!.json();
    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const reply = candidate?.content?.parts?.[0]?.text ?? '';

    // Log les réponses inattendues (safety filter, max tokens, etc.)
    if (finishReason && finishReason !== 'STOP') {
      console.error('Gemini finishReason non-STOP:', finishReason, '| reply:', reply.slice(0, 100));
    }

    // Si safety filter a tout bloqué → message neutre
    if (!reply && finishReason === 'SAFETY') {
      return NextResponse.json(
        { text: "Je ne peux pas répondre à cette question. Essaie de reformuler.", reply: "Je ne peux pas répondre à cette question. Essaie de reformuler." },
        { status: 200 }
      );
    }

    // Réponse vide ou trop courte sans finishReason STOP → erreur
    const finalReply = reply || '…';

    // 7) Log usage (optionnel, pour stats) — fire and forget
    try {
      await adminDb.collection('aiUsage').add({
        uid,
        lang: lang ?? 'fr',
        inputLen: userText.length,
        outputLen: finalReply.length,
        finishReason: finishReason ?? 'STOP',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch { /* non bloquant */ }

    // Retourne "text" (mobile) ET "reply" (web) pour compatibilité
    return NextResponse.json({ text: finalReply, reply: finalReply });

  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
