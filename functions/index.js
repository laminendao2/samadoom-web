const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { Resend } = require('resend');

initializeApp();

const getResend = () => new Resend(process.env.RESEND_API_KEY);
const FROM = 'SamaDoom <noreply@samadoom.com>';
const APP_NAME = 'SamaDoom';
const LOGO_URL = 'https://samadoom.com/logo.png'; // à mettre à jour si besoin

// ─── Email HTML template ───────────────────────────────────────────────
function buildEmail({ title, greeting, body, ctaLabel, ctaUrl, footer }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0D3320 0%,#1a5c38 100%);padding:32px 40px;text-align:center;">
            <span style="font-size:26px;font-weight:800;color:#C9A84C;letter-spacing:1px;">${APP_NAME}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">${greeting}</p>
            <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">${body}</p>
            ${ctaUrl ? `
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#0D3320;border-radius:8px;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#C9A84C;text-decoration:none;">${ctaLabel}</a>
                </td>
              </tr>
            </table>
            ` : ''}
            <p style="margin:0;font-size:13px;color:#6B7280;">${footer}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} ${APP_NAME} · <a href="https://samadoom.com" style="color:#9CA3AF;">samadoom.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Réinitialisation du mot de passe ─────────────────────────────────
exports.sendPasswordReset = onCall({ region: 'us-east1' }, async (request) => {
  const { email } = request.data;
  if (!email) throw new HttpsError('invalid-argument', 'Email requis');

  try {
    const link = await getAuth().generatePasswordResetLink(email);
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `Réinitialisez votre mot de passe ${APP_NAME}`,
      html: buildEmail({
        title: `Réinitialisation du mot de passe`,
        greeting: `Bonjour,`,
        body: `Vous avez demandé à réinitialiser votre mot de passe pour votre compte <strong>${APP_NAME}</strong>.<br/>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.`,
        ctaLabel: '🔑 Réinitialiser mon mot de passe',
        ctaUrl: link,
        footer: `Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe reste inchangé.`,
      }),
    });
    return { success: true };
  } catch (err) {
    console.error('sendPasswordReset error:', err);
    throw new HttpsError('internal', 'Impossible d\'envoyer l\'email');
  }
});

// ─── Vérification d'email ─────────────────────────────────────────────
exports.sendEmailVerification = onCall({ region: 'us-east1' }, async (request) => {
  const { email } = request.data;
  if (!email) throw new HttpsError('invalid-argument', 'Email requis');

  try {
    const link = await getAuth().generateEmailVerificationLink(email);
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: `Vérifiez votre adresse email ${APP_NAME}`,
      html: buildEmail({
        title: `Vérification d'email`,
        greeting: `Bienvenue sur ${APP_NAME} !`,
        body: `Merci de vous être inscrit(e). Cliquez sur le bouton ci-dessous pour vérifier votre adresse email et activer votre compte.`,
        ctaLabel: '✅ Vérifier mon email',
        ctaUrl: link,
        footer: `Si vous n'avez pas créé de compte sur ${APP_NAME}, ignorez cet email.`,
      }),
    });
    return { success: true };
  } catch (err) {
    console.error('sendEmailVerification error:', err);
    throw new HttpsError('internal', 'Impossible d\'envoyer l\'email');
  }
});

// ─── PayDunya ─────────────────────────────────────────────────────────
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const PD_BASE = 'https://app.paydunya.com/api/v1';
const PD_HEADERS = () => ({
  'PAYDUNYA-MASTER-KEY':  process.env.PAYDUNYA_MASTER,
  'PAYDUNYA-PUBLIC-KEY':  process.env.PAYDUNYA_PUBLIC,
  'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE,
  'PAYDUNYA-TOKEN':       process.env.PAYDUNYA_TOKEN,
  'Content-Type': 'application/json',
});
const PLANS = {
  mensuel: { amount: 3000,  label: 'Abonnement SamaDoom Mensuel', days: 30  },
  annuel:  { amount: 24000, label: 'Abonnement SamaDoom Annuel',  days: 365 },
};

exports.paydunyaMobileInvoice = onRequest({ region: 'us-east1', cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }
  const idToken = (req.headers.authorization || '').replace('Bearer ', '');
  let uid;
  try { uid = (await getAuth().verifyIdToken(idToken)).uid; }
  catch (_) { res.status(401).json({ error: 'Non autorise' }); return; }
  const plan = req.body && req.body.plan ? req.body.plan : 'mensuel';
  const info = PLANS[plan];
  if (!info) { res.status(400).json({ error: 'Plan invalide' }); return; }
  try {
    const r = await fetch(PD_BASE + '/checkout-invoice/create', {
      method: 'POST',
      headers: PD_HEADERS(),
      body: JSON.stringify({
        invoice:     { total_amount: info.amount, description: info.label },
        store:       { name: 'SamaDoom' },
        custom_data: { uid: uid, plan: plan },
        customer:    { country: req.body.country || 'SN' },
        actions: {
          cancel_url:   'https://samadoom.com/abonnement?status=cancel',
          return_url:   'https://samadoom.com/abonnement?status=success',
          callback_url: 'https://us-east1-amnafj-3f7dd.cloudfunctions.net/paydunyaCallback',
        },
      }),
    });
    const d = await r.json();
    if (d.response_code !== '00') { res.status(502).json({ error: d.description }); return; }
    res.json({ checkoutUrl: d.response_text, token: d.token });
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ─── Activation sécurisée ────────────────────────────────────
// Le paiement est confirmé auprès de PayDunya, doit appartenir à l'utilisateur
// (custom_data.uid), être au bon montant, et n'est appliqué qu'une seule fois
// (verrou transactionnel dans payments/{token}).
function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

async function activateInvoice(token, expectedUid) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{6,80}$/.test(token)) return 'invalid';
  const r = await fetch(PD_BASE + '/checkout-invoice/confirm/' + token, { headers: PD_HEADERS() });
  const d = await r.json();
  const status = String((d && d.status) || 'pending').toLowerCase();
  if (status !== 'completed') return status === 'failed' || status === 'cancelled' ? 'failed' : 'pending';

  const custom = d.custom_data || {};
  // Facture créée par le site web (custom_data.userId) : gérée par samadoom.com
  const uid = custom.uid || null;
  const plan = Object.prototype.hasOwnProperty.call(PLANS, custom.plan) ? custom.plan : null;
  if (!uid || !plan) return 'invalid';
  if (expectedUid && uid !== expectedUid) return 'forbidden';
  if (String(d.mode || 'live').toLowerCase() !== 'live') return 'invalid';
  const paid = Math.round(Number(d.invoice && d.invoice.total_amount));
  if (!Number.isFinite(paid) || paid < PLANS[plan].amount) return 'invalid';

  const db = getFirestore();
  const payRef = db.doc('payments/' + token);
  const userRef = db.doc('users/' + uid);
  await db.runTransaction(async (tx) => {
    const paySnap = await tx.get(payRef);
    if (paySnap.exists && paySnap.data().status === 'completed') return; // déjà appliqué
    const userSnap = await tx.get(userRef);
    const u = userSnap.data() || {};
    const now = new Date();
    const ends = [toDate(u.subscriptionEnd), toDate(u.planExpiresAt)].filter(Boolean);
    const currentEnd = ends.length ? new Date(Math.max.apply(null, ends.map((x) => x.getTime()))) : null;
    const base = currentEnd && currentEnd > now ? currentEnd : now; // renouvellement anticipé : on cumule
    const end = new Date(base.getTime() + PLANS[plan].days * 86400000);
    tx.set(payRef, {
      token: token, userId: uid, plan: plan, amount: paid, currency: 'XOF',
      status: 'completed', provider: 'paydunya', source: 'mobile',
      completedAt: now.toISOString(),
    }, { merge: true });
    tx.set(userRef, {
      subscriptionEnd: end, plan: plan, isPro: true,
      planActivatedAt: now.toISOString(), planExpiresAt: end.toISOString(),
      lastPaymentToken: token, lastPaymentProvider: 'paydunya',
    }, { merge: true });
  });
  return 'completed';
}

exports.paydunyaPaymentStatus = onRequest({ region: 'us-east1', cors: true }, async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  const idToken = (req.headers.authorization || '').replace('Bearer ', '');
  let uid;
  try { uid = (await getAuth().verifyIdToken(idToken)).uid; }
  catch (_) { res.status(401).json({ error: 'Non autorise' }); return; }
  const token = req.query.token;
  if (!token) { res.status(400).json({ error: 'Token manquant' }); return; }
  try {
    // Un utilisateur ne peut faire valoir que SA facture, et une seule fois
    const result = await activateInvoice(String(token), uid);
    if (result === 'forbidden') { res.status(403).json({ error: 'Acces refuse' }); return; }
    if (result === 'invalid')   { res.status(400).json({ error: 'Paiement invalide' }); return; }
    res.json({ status: result });
  } catch (e) { res.status(500).json({ error: 'Erreur serveur' }); }
});

exports.paydunyaCallback = onRequest({ region: 'us-east1' }, async (req, res) => {
  // L'IPN PayDunya arrive en formulaire : data[invoice][token]
  let data = req.body && req.body.data ? req.body.data : null;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { data = null; } }
  const token = data ? ((data.invoice && data.invoice.token) || data.invoice_token || null) : null;
  if (!token) { res.status(400).send('No token'); return; }
  try {
    await activateInvoice(String(token), null);
    res.status(200).send('OK');
  } catch (_) { res.status(500).send('Error'); }
});
