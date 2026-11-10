import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  initRevenueCat, getOfferings, purchasePackage,
  restorePurchases, checkSubscription, ENTITLEMENT_ID,
} from '../../services/iap';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const FALLBACK_PLANS = [
  {
    id: 'mensuel', label: 'Mensuel', price: '6,99 $', period: '/ mois',
    badge: null, highlight: false,
    features: ['Accès complet au Coran', 'Audio mot-à-mot', 'Suivi de progression', 'Prières & Qibla', 'Hadiths & Invocations', 'Quiz islamique'],
  },
  {
    id: 'annuel', label: 'Annuel', price: '39,99 $', period: '/ an',
    badge: '🎉 -33%', highlight: true,
    features: ['Tout le plan Mensuel', 'Économisez 20 $ par an', 'Calendrier islamique', 'Historique complet', 'Accès prioritaire aux nouveautés'],
  },
];

export default function AbonnementScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [loading,    setLoading]    = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subEndDate, setSubEndDate] = useState(null);
  const [offerings,  setOfferings]  = useState(null);
  const [buying,     setBuying]     = useState(null);
  const [restoring,  setRestoring]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (user?.uid) await initRevenueCat(user.uid);
        // Vérifier isPro + planExpiresAt + subscriptionEnd depuis Firestore (paiement web PayDunya)
        let firestoreSubscribed = false;
        try {
          const snap = await getDoc(doc(db, 'users', user?.uid));
          if (snap.exists()) {
            const data = snap.data();
            const now = new Date();
            // subscriptionEnd (ancienne logique)
            if (data.subscriptionEnd) {
              const end = data.subscriptionEnd.toDate
                ? data.subscriptionEnd.toDate()
                : new Date(data.subscriptionEnd);
              if (end > now) { setSubEndDate(end); firestoreSubscribed = true; }
            }
            // isPro + planExpiresAt (paiement PayDunya web)
            if (data.isPro === true) {
              if (data.planExpiresAt) {
                const expires = new Date(data.planExpiresAt);
                if (expires > now) {
                  firestoreSubscribed = true;
                  setSubEndDate(expires);
                }
              } else {
                firestoreSubscribed = true;
              }
            }
          }
        } catch {}
        const [off, sub] = await Promise.all([getOfferings(), checkSubscription()]);
        setOfferings(off);
        setSubscribed(sub || firestoreSubscribed);
      } catch (e) {
        console.warn('AbonnementScreen init error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const handleBuy = useCallback(async (pkg, planId) => {
    setBuying(planId);

    // ── Option A : RevenueCat disponible (ou réessayer le chargement) ──────────
    let activePkg = pkg;

    // Si pas de package, on réessaie de charger les offres RevenueCat
    if (!activePkg) {
      try {
        if (user?.uid) await initRevenueCat(user.uid);
        const freshOfferings = await getOfferings();
        if (freshOfferings?.current) {
          setOfferings(freshOfferings);
          const pkgs = freshOfferings.current.availablePackages;
          activePkg = planId === 'mensuel'
            ? pkgs.find(p => p.packageType === 'MONTHLY') || null
            : pkgs.find(p => p.packageType === 'ANNUAL')  || null;
        }
      } catch (e) {
        console.warn('Retry getOfferings failed:', e);
      }
    }

    if (activePkg) {
      try {
        const { customerInfo } = await purchasePackage(activePkg);
        if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
          setSubscribed(true);
          Alert.alert('✅ Abonnement activé !', 'Bienvenue dans SamaDoom Islam Premium.');
        }
      } catch (e) {
        if (!e.userCancelled) Alert.alert('Erreur', e.message || 'Achat impossible. Réessayez.');
      }
      setBuying(null);
      return;
    }

    // ── Option B : Aucun package RevenueCat disponible → message d'erreur ──────
    Alert.alert(
      'Paiement indisponible',
      'Impossible de contacter le service de paiement pour le moment. Vérifiez votre connexion internet et réessayez.',
      [{ text: 'OK' }]
    );
    setBuying(null);
  }, []);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (info?.entitlements?.active?.[ENTITLEMENT_ID]) {
        setSubscribed(true);
        Alert.alert('✅ Abonnement restauré !');
      } else {
        Alert.alert('Aucun abonnement trouvé', 'Aucun achat précédent trouvé pour ce compte.');
      }
    } catch (e) {
      Alert.alert('Erreur', e.message || 'Restauration impossible.');
    }
    setRestoring(false);
  }, []);

  // Mappe les packages RevenueCat sur les plans
  const getPackage = (planId) => {
    if (!offerings?.current) return null;
    const pkgs = offerings.current.availablePackages;
    if (planId === 'mensuel') return pkgs.find(p => p.packageType === 'MONTHLY') || null;
    if (planId === 'annuel')  return pkgs.find(p => p.packageType === 'ANNUAL')  || null;
    return null;
  };

  const getPriceString = (planId) => {
    const pkg = getPackage(planId);
    return pkg?.product?.priceString || (planId === 'mensuel' ? '6,99 $' : '39,99 $');
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#0D3320', '#1a5c38']} style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>✨ Abonnement Islam</Text>
          <Text style={s.subtitle}>Accès complet à tous les contenus islamiques</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#0D3320" /></View>
      ) : subscribed ? (
        <View style={s.center}>
          <Text style={{ fontSize: 56 }}>✅</Text>
          <Text style={s.subscribedTitle}>Abonnement actif</Text>
          <Text style={s.subscribedSub}>Vous avez accès à tous les contenus islamiques.</Text>
          {subEndDate && (
            <Text style={[s.subscribedSub, { marginTop: 6, fontWeight: '700', color: '#0D3320' }]}>
              Valide jusqu'au {subEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          )}
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backBtnTxt}>Retour au dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {/* Avantages */}
          <View style={s.benefitsBox}>
            <Text style={s.benefitsTitle}>Pourquoi s'abonner ?</Text>
            {[
              '📖  Coran avec audio et suivi verset par verset',
              '🤲  Invocations, Hadiths et Histoires des Prophètes',
              '🕌  Prières, Qibla et Calendrier islamique',
              '📊  Progression suivie par votre professeur',
              '🧠  Quiz islamique interactif',
            ].map((line, i) => (
              <Text key={i} style={s.benefitLine}>{line}</Text>
            ))}
          </View>

          {/* Plans */}
          {FALLBACK_PLANS.map(plan => (
            <View key={plan.id} style={[s.card, plan.highlight && s.cardHighlight]}>
              {plan.badge && (
                <View style={s.badge}><Text style={s.badgeTxt}>{plan.badge}</Text></View>
              )}
              <View style={s.cardHeader}>
                <Text style={[s.planLabel, plan.highlight && { color: '#C9A84C' }]}>{plan.label}</Text>
                <View style={s.priceRow}>
                  <Text style={[s.price, plan.highlight && { color: '#C9A84C' }]}>
                    {getPriceString(plan.id)}
                  </Text>
                  <Text style={[s.period, plan.highlight && { color: 'rgba(201,168,76,0.6)' }]}>
                    {plan.period}
                  </Text>
                </View>
              </View>
              <View style={s.divider} />
              {plan.features.map((f, i) => (
                <Text key={i} style={[s.feature, !plan.highlight && { color: '#374151' }]}>✓  {f}</Text>
              ))}
              <TouchableOpacity
                style={[s.cta, { backgroundColor: plan.highlight ? '#C9A84C' : '#0D3320' }, buying === plan.id && { opacity: 0.7 }]}
                onPress={() => handleBuy(getPackage(plan.id), plan.id)}
                disabled={buying !== null}
                activeOpacity={0.85}
              >
                {buying === plan.id
                  ? <ActivityIndicator color={plan.highlight ? '#0D3320' : '#C9A84C'} />
                  : <Text style={[s.ctaTxt, { color: plan.highlight ? '#0D3320' : '#C9A84C' }]}>Choisir ce plan</Text>
                }
              </TouchableOpacity>
            </View>
          ))}

          {/* Restaurer */}
          <TouchableOpacity onPress={handleRestore} disabled={restoring} style={s.restoreBtn}>
            {restoring
              ? <ActivityIndicator color="#6B7280" size="small" />
              : <Text style={s.restoreTxt}>Restaurer un achat précédent</Text>
            }
          </TouchableOpacity>

          <Text style={s.legal}>
            {'Paiement débité sur votre compte Apple ID à la confirmation. Renouvellement automatique sauf résiliation 24h avant la fin de la période.'}
            {'\n'}{"Annulation à tout moment dans les paramètres de l'App Store."}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#F8F9FA' },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  header:          { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back:            { width: 36, height: 36, justifyContent: 'center' },
  backTxt:         { fontSize: 32, color: '#fff', lineHeight: 36 },
  headerText:      { flex: 1 },
  title:           { fontSize: 18, fontWeight: '800', color: '#fff' },
  subtitle:        { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  body:            { padding: 16, paddingBottom: 48 },
  benefitsBox:     { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  benefitsTitle:   { fontSize: 15, fontWeight: '800', color: '#0D3320', marginBottom: 12 },
  benefitLine:     { fontSize: 14, color: '#374151', marginBottom: 7, lineHeight: 20 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, position: 'relative' },
  cardHighlight:   { backgroundColor: '#0D3320', borderWidth: 2, borderColor: '#C9A84C' },
  badge:           { position: 'absolute', top: -10, right: 16, backgroundColor: '#C9A84C', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeTxt:        { fontSize: 12, fontWeight: '800', color: '#0D3320' },
  cardHeader:      { marginBottom: 12 },
  planLabel:       { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 },
  priceRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 },
  price:           { fontSize: 32, fontWeight: '900', color: '#111827' },
  period:          { fontSize: 14, color: '#9CA3AF', marginBottom: 4 },
  divider:         { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },
  feature:         { fontSize: 13, color: '#D1FAE5', marginBottom: 6, lineHeight: 18 },
  cta:             { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  ctaTxt:          { fontSize: 15, fontWeight: '800' },
  restoreBtn:      { alignItems: 'center', paddingVertical: 14 },
  restoreTxt:      { fontSize: 13, color: '#6B7280', textDecorationLine: 'underline' },
  legal:           { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 4, lineHeight: 16, paddingHorizontal: 8 },
  subscribedTitle: { fontSize: 22, fontWeight: '800', color: '#0D3320', marginTop: 16 },
  subscribedSub:   { fontSize: 15, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  backBtn:         { marginTop: 24, backgroundColor: '#0D3320', borderRadius: 10, paddingHorizontal: 32, paddingVertical: 14 },
  backBtnTxt:      { color: '#C9A84C', fontWeight: '800', fontSize: 15 },
});
