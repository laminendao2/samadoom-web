export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#1a1a1a' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Politique de confidentialité</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Dernière mise à jour : novembre 2026 — <strong>Sama Doom</strong></p>

      <h2>1. Objet</h2>
      <p>
        Sama Doom est une application d&apos;éducation islamique permettant l&apos;apprentissage du Coran,
        le suivi des progrès, le parrainage et l&apos;accumulation de hassanas. La présente politique
        décrit comment nous collectons, utilisons et protégeons vos données personnelles.
      </p>

      <h2>2. Données collectées</h2>
      <p>Lors de votre inscription et utilisation de l&apos;application, nous collectons :</p>
      <ul>
        <li>Nom et adresse e-mail (lors de la création de compte)</li>
        <li>Rôle dans l&apos;application (élève, parent, professeur)</li>
        <li>Données de progression (sourates lues, versets mémorisés)</li>
        <li>Informations de paiement traitées via des prestataires sécurisés (PayDunya, Stripe)</li>
        <li>Code de parrainage et historique des commissions</li>
        <li>Données de connexion (adresse IP, appareil, système d&apos;exploitation)</li>
      </ul>

      <h2>3. Utilisation des données</h2>
      <p>Vos données sont utilisées exclusivement pour :</p>
      <ul>
        <li>Fournir et améliorer les services de l&apos;application</li>
        <li>Gérer votre abonnement et vos paiements</li>
        <li>Calculer et verser les commissions de parrainage</li>
        <li>Envoyer des notifications liées à votre progression</li>
        <li>Assurer la sécurité et prévenir les fraudes</li>
      </ul>

      <h2>4. Partage des données</h2>
      <p>
        Nous ne vendons ni ne partageons vos données personnelles avec des tiers à des fins commerciales.
        Vos données peuvent être transmises uniquement à nos prestataires techniques (hébergement,
        paiement) dans le strict cadre de la fourniture du service.
      </p>

      <h2>5. Conservation des données</h2>
      <p>
        Vos données sont conservées pendant toute la durée de votre utilisation du service,
        puis supprimées dans un délai de 90 jours suivant la suppression de votre compte,
        sauf obligation légale contraire.
      </p>

      <h2>6. Vos droits</h2>
      <p>Conformément aux réglementations applicables, vous disposez du droit de :</p>
      <ul>
        <li>Accéder à vos données personnelles</li>
        <li>Rectifier des informations inexactes</li>
        <li>Demander la suppression de vos données</li>
        <li>Vous opposer au traitement de vos données</li>
      </ul>
      <p>Pour exercer ces droits, contactez-nous à : <strong>support@freejobla.com</strong></p>

      <h2>7. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
        protéger vos données contre tout accès non autorisé, perte ou divulgation.
      </p>

      <h2>8. Contact</h2>
      <p>
        Pour toute question relative à cette politique de confidentialité :<br />
        <strong>Email :</strong> support@freejobla.com<br />
        <strong>Site :</strong> https://samadoom.com
      </p>
    </main>
  );
}
