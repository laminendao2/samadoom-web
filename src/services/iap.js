/**
 * Service IAP SamaDoom — RevenueCat
 * v8: react-native-purchases@^8.5.0 avec NDK r28 (16KB alignment OK)
 * iOS  → Apple In-App Purchases via RevenueCat
 */
import { Platform } from 'react-native';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const PRODUCT_IDS = {
  mensuel: Platform.OS === 'ios'
    ? 'com.mycompany.daara.islam_mensuel'
    : 'com.mycompany.daara.islam_mensuel',
  annuel: Platform.OS === 'ios'
    ? 'com.mycompany.daara.islam_annuel'
    : 'com.mycompany.daara.islam_annuel',
};

export const RC_KEYS = {
  ios:     'appl_FYyUPCaYzZRIVPjpmnewotyfrAG',
  android: 'goog_OOArAuCLXtpfmvLVTpuzLJuwtLF',
};

export const ENTITLEMENT_ID = 'sama_doom_pro';

// Chargement lazy sécurisé de react-native-purchases v8
let Purchases = null;
const loadRC = () => {
  if (Purchases) return Purchases;
  try {
    const mod = require('react-native-purchases');
    Purchases = mod.default || mod;
  } catch (e) {
    console.warn('[IAP] react-native-purchases non disponible:', e.message);
    Purchases = null;
  }
  return Purchases;
};

export async function initRevenueCat(userId) {
  const RC = loadRC();
  if (!RC) return;
  try {
    const key = Platform.OS === 'ios' ? RC_KEYS.ios : RC_KEYS.android;
    await RC.configure({ apiKey: key, appUserID: userId });
  } catch (e) {
    console.warn('[IAP] initRevenueCat error:', e);
  }
}

export async function getOfferings() {
  const RC = loadRC();
  if (!RC) return null;
  try {
    return await RC.getOfferings();
  } catch (e) {
    console.warn('[IAP] getOfferings error:', e);
    return null;
  }
}

export async function purchasePackage(pkg) {
  const RC = loadRC();
  if (!RC) throw new Error('Achat indisponible — mettez à jour l\'application');
  return await RC.purchasePackage(pkg);
}

export async function restorePurchases() {
  const RC = loadRC();
  if (!RC) throw new Error('Restauration indisponible — mettez à jour l\'application');
  return await RC.restorePurchases();
}

export async function checkSubscription() {
  // 1. Vérifier RevenueCat
  const RC = loadRC();
  if (RC) {
    try {
      const info = await RC.getCustomerInfo();
      if (info?.entitlements?.active?.[ENTITLEMENT_ID]) return true;
    } catch { /* ignore, check Firestore below */ }
  }

  // 2. Fallback Firestore (abonnements manuels / PayDunya callback)
  try {
    const auth = getAuth();
    const uid  = auth.currentUser?.uid;
    if (uid) {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.subscriptionEnd) {
          const end = data.subscriptionEnd.toDate
            ? data.subscriptionEnd.toDate()
            : new Date(data.subscriptionEnd);
          if (end > new Date()) return true;
        }
        if (['admin', 'superadmin', 'professeur'].includes(data.role)) return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}
