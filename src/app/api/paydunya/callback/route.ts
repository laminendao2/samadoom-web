import { NextRequest, NextResponse } from 'next/server';
import { activatePaydunyaPayment, isValidPaydunyaHash, parsePaydunyaBody } from '@/lib/subscription';

/**
 * Webhook (IPN) PayDunya.
 * Le contenu de la requête n'est jamais cru : on n'en tire que le token de
 * facture, puis le paiement est confirmé directement auprès de l'API PayDunya
 * avant toute activation (voir activatePaydunyaPayment).
 */
export async function POST(req: NextRequest) {
  try {
    const body = parsePaydunyaBody(await req.text());
    const token = body['invoice.token'] ?? body['token'];

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
    }
    // Si un hash est fourni il doit être le bon (SHA-512 de la MasterKey)
    if (body['hash'] && !isValidPaydunyaHash(body['hash'])) {
      console.warn('PayDunya callback: hash invalide pour', token);
      return NextResponse.json({ error: 'Signature invalide' }, { status: 403 });
    }

    const outcome = await activatePaydunyaPayment(token);
    console.log(`PayDunya callback ${token}: ${outcome.result}`);

    if (outcome.result === 'not_found') {
      return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }
    if (outcome.result === 'unreachable') {
      // 5xx → PayDunya renverra la notification plus tard
      return NextResponse.json({ error: 'Confirmation indisponible' }, { status: 503 });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('PayDunya callback error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
