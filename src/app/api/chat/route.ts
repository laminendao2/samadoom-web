import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export async function POST(req: NextRequest) {
  try {
    // Authenticate via Firebase ID token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    try {
      await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
    }

    const { message, history = [], systemPrompt } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'Message manquant' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Service IA non configuré' }, { status: 500 });
    }

    // Build Gemini contents from history
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'model') {
        contents.push({ role: msg.role, parts: [{ text: msg.text }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const body: {
      contents: { role: string; parts: { text: string }[] }[];
      systemInstruction?: { parts: { text: string }[] };
    } = { contents };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      return NextResponse.json({ error: 'Erreur IA' }, { status: 502 });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '…';

    return NextResponse.json({ text });
  } catch (err) {
    console.error('/api/chat error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
