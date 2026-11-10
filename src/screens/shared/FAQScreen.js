import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const FAQS = [
  {
    category: '🏫 École & Inscription',
    items: [
      {
        q: "Comment rejoindre une école sur SamaDoom ?",
        a: "Demandez à l'administrateur de votre école de vous inscrire. Vous recevrez un code d'accès ou une invitation directe dans l'application.",
      },
      {
        q: "Je ne vois pas mon école dans la liste, que faire ?",
        a: "Votre école n'est peut-être pas encore inscrite sur SamaDoom. Demandez à la direction de contacter notre équipe pour créer un compte établissement.",
      },
      {
        q: "Comment rejoindre un groupe (Halaqa) ?",
        a: "Depuis l'accueil, appuyez sur « Rejoindre Halaqa » et entrez le code partagé par votre enseignant.",
      },
    ],
  },
  {
    category: '📚 Contenu islamique',
    items: [
      {
        q: "Les étapes de la prière sont-elles conformes à l'école Maliki ?",
        a: "Oui. Tout le contenu religieux de SamaDoom est rédigé selon le madhab Maliki, la tradition dominante en Afrique de l'Ouest, et validé par des enseignants qualifiés.",
      },
      {
        q: "Puis-je accéder au contenu sans connexion internet ?",
        a: "Le Coran et certaines leçons sont disponibles hors ligne après un premier chargement. Le contenu mis à jour en temps réel (étapes de prière, hadiths) nécessite une connexion.",
      },
      {
        q: "Le contenu est-il disponible en arabe et en français ?",
        a: "Oui. Les récitations, hadiths et étapes de prière sont affichés en arabe, avec translittération et traduction en français.",
      },
    ],
  },
  {
    category: '🔔 Notifications & Prières',
    items: [
      {
        q: "Comment activer les rappels de prière ?",
        a: "Allez dans « Prières » depuis l'accueil, puis activez les notifications horaires. Assurez-vous d'autoriser les notifications dans les réglages de votre téléphone.",
      },
      {
        q: "Les horaires de prière sont-ils précis pour ma ville ?",
        a: "Oui. SamaDoom utilise votre position géographique pour calculer les horaires selon la méthode de calcul adaptée à votre région.",
      },
    ],
  },
  {
    category: '⭐ Abonnement & Paiement',
    items: [
      {
        q: "Qu'est-ce qui est inclus dans l'abonnement premium ?",
        a: "L'abonnement premium donne accès à tous les cours vidéo, les exercices interactifs, le suivi de progression avancé et le contenu exclusif des enseignants.",
      },
      {
        q: "Comment annuler mon abonnement ?",
        a: "Sur iPhone : Réglages → votre nom → Abonnements → SamaDoom → Annuler.",
      },
      {
        q: "Mon paiement n'est pas passé, que faire ?",
        a: "Vérifiez que votre moyen de paiement est actif et que vous avez une connexion internet stable. Si le problème persiste, contactez-nous par email.",
      },
    ],
  },
  {
    category: '🛠️ Problèmes techniques',
    items: [
      {
        q: "L'application se ferme toute seule, que faire ?",
        a: "Fermez complètement l'app et relancez-la. Si le problème persiste, vérifiez que vous avez la dernière version dans l'App Store.",
      },
      {
        q: "Je n'arrive pas à me connecter à mon compte.",
        a: "Vérifiez votre adresse email et mot de passe. Utilisez « Mot de passe oublié » si nécessaire. Si votre compte a été créé par un administrateur, contactez-le directement.",
      },
      {
        q: "Comment mettre à jour l'application ?",
        a: "SamaDoom se met à jour automatiquement en arrière-plan (OTA). Pour les mises à jour majeures, rendez-vous dans l'App Store.",
      },
    ],
  },
];

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.faqItem, open && styles.faqItemOpen]}
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{item.q}</Text>
        <Text style={styles.faqChevron}>{open ? '▲' : '▼'}</Text>
      </View>
      {open && <Text style={styles.faqA}>{item.a}</Text>}
    </TouchableOpacity>
  );
}

export default function FAQScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0277BD', '#01579B']} style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerIcon}>💬</Text>
        <Text style={styles.headerTitle}>Aide & FAQ</Text>
        <Text style={styles.headerSub}>Questions fréquentes</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {FAQS.map((cat, ci) => (
          <View key={ci} style={styles.category}>
            <Text style={styles.catLabel}>{cat.category}</Text>
            {cat.items.map((item, ii) => (
              <FAQItem key={ii} item={item} />
            ))}
          </View>
        ))}

        <View style={styles.contact}>
          <Text style={styles.contactTitle}>Vous n'avez pas trouvé votre réponse ?</Text>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => Linking.openURL('mailto:support@freejobla.com')}
          >
            <Text style={styles.contactBtnTxt}>✉️  Nous contacter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F5F5F5' },
  header:       { paddingTop: 16, paddingBottom: 24, paddingHorizontal: 20, alignItems: 'center' },
  back:         { position: 'absolute', left: 16, top: 16, padding: 8 },
  backTxt:      { color: '#fff', fontSize: 28, lineHeight: 30 },
  headerIcon:   { fontSize: 36, marginBottom: 6 },
  headerTitle:  { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub:    { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  scroll:       { padding: 16, paddingBottom: 40 },
  category:     { marginBottom: 20 },
  catLabel:     { fontSize: 15, fontWeight: '700', color: '#01579B', marginBottom: 10, marginLeft: 4 },
  faqItem:      { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8,
                  shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
                  elevation: 2 },
  faqItemOpen:  { borderLeftWidth: 3, borderLeftColor: '#0277BD' },
  faqHeader:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  faqQ:         { flex: 1, fontSize: 14, fontWeight: '600', color: '#212121', lineHeight: 20, paddingRight: 8 },
  faqChevron:   { fontSize: 11, color: '#0277BD', marginTop: 2 },
  faqA:         { marginTop: 10, fontSize: 13, color: '#555', lineHeight: 19 },
  contact:      { backgroundColor: '#E3F2FD', borderRadius: 14, padding: 20, alignItems: 'center', marginTop: 8 },
  contactTitle: { fontSize: 14, color: '#01579B', fontWeight: '600', textAlign: 'center', marginBottom: 14 },
  contactBtn:   { backgroundColor: '#0277BD', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  contactBtnTxt:{ color: '#fff', fontWeight: '700', fontSize: 14 },
});
