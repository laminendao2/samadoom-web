export function getPasswordResetEmail(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisez votre mot de passe</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#0D3320;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <img src="https://samadoom.com/logo.png" alt="Sama Doom" width="52" height="52"
                   style="border-radius:10px;display:inline-block;margin-bottom:12px;" />
              <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:1px;">SAMA DOOM</div>
              <div style="color:#C9A84C;font-size:12px;margin-top:4px;">La réussite scolaire, ensemble</div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
                Réinitialisez votre mot de passe
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
                Vous avez demandé à réinitialiser votre mot de passe Sama Doom.<br>
                Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
              </p>

              <div style="text-align:center;margin:32px 0;">
                <a href="${resetLink}"
                   style="display:inline-block;background-color:#0D3320;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                  Réinitialiser mon mot de passe
                </a>
              </div>

              <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;text-align:center;">
                Ce lien expire dans <strong>1 heure</strong>.
              </p>
              <p style="margin:12px 0 0;font-size:13px;color:#9CA3AF;text-align:center;">
                Si vous n'avez pas demandé cet e-mail, ignorez-le.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#f9fafb;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                © ${new Date().getFullYear()} Sama Doom · 
                <a href="https://samadoom.com/privacy" style="color:#6B7280;text-decoration:none;">Confidentialité</a> · 
                <a href="https://samadoom.com/terms" style="color:#6B7280;text-decoration:none;">Conditions</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getEmailVerificationEmail(verifyLink: string, displayName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Validez votre adresse e-mail</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#0D3320;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
              <img src="https://samadoom.com/logo.png" alt="Sama Doom" width="52" height="52"
                   style="border-radius:10px;display:inline-block;margin-bottom:12px;" />
              <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:1px;">SAMA DOOM</div>
              <div style="color:#C9A84C;font-size:12px;margin-top:4px;">La réussite scolaire, ensemble</div>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
                Bonjour ${displayName ? displayName.split(' ')[0] : ''} 👋
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
                Bienvenue sur Sama Doom ! Cliquez sur le bouton ci-dessous pour valider 
                votre adresse e-mail et activer votre compte.
              </p>

              <div style="text-align:center;margin:32px 0;">
                <a href="${verifyLink}"
                   style="display:inline-block;background-color:#0D3320;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                  Valider mon adresse e-mail
                </a>
              </div>

              <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;text-align:center;">
                Si vous n'avez pas créé de compte Sama Doom, ignorez cet e-mail.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#f9fafb;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                © ${new Date().getFullYear()} Sama Doom · 
                <a href="https://samadoom.com/privacy" style="color:#6B7280;text-decoration:none;">Confidentialité</a> · 
                <a href="https://samadoom.com/terms" style="color:#6B7280;text-decoration:none;">Conditions</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
