# SamaDoom — Contexte projet pour Claude

## Stack technique
- React Native 0.81.5 + Expo SDK 54 (managed workflow)
- Firebase JS SDK v11 : Firestore, Auth, Storage
- EAS Build (cloud builds) + EAS Update (OTA)
- Navigation : React Navigation (Stack + Tab)
- Version app actuelle : **2.4.3** (Build 97 — ✅ SUCCÈS — soumis à Apple le 08/11/2026)

## Firebase
- Project ID : `amnafj-3f7dd`
- authDomain : `amnafj-3f7dd.firebaseapp.com`
- App bundle iOS/Android : `com.mycompany.daara`
- Slug Expo : `sama-doom` / Owner : `laminendao2`
- EAS Project ID : `da8a8267-9919-4c3f-80d8-f5fd9c1dfb89`

## Règles de sécurité CRITIQUES
- Ne PAS toucher au `package-lock.json` (sauf exception explicite — a été modifié pour upgrade react-native-purchases)
- Ne pas faire de build sans demander le go à l'utilisateur
- Ne pas faire de nettoyage sans autorisation explicite
- Ne PAS mettre `versionCode` dans `app.json` — EAS le gère via `appVersionSource: "remote"` + `autoIncrement: true`
- **⚠️ `react-native-purchases` n'a PAS de plugin Expo — NE JAMAIS l'ajouter dans `app.json` plugins. PERMANENT.**
- **⚠️ `functions/.env` est gitignored — NE JAMAIS committer ce fichier (contient des secrets)**
- **⚠️ Avant tout build, prévenir l'utilisateur et attendre son go (sauf si explicitement dit "fais automatiquement")**

## Dépendances clés (versions fixes pour SDK 54)
- `expo-location` : `~19.0.8`
- `expo-speech-recognition` : `~3.1.3`
- `react-native-agora` : `^4.6.4` (SDK natif, nécessite build — **déjà dans iOS build 59 + Android build 62+**)
- Agora App ID : `fa1b8525b15f4ab7a48ba7899898fc22` (mode test, token = null)

## Architecture des rôles
- **SuperAdmin** : `laminendao2@gmail.com` ou `laminendao2@hotmail.com`
  - Champ Firestore : `role == 'superadmin'` (ou `'superadmin' in roles`)
  - Navigation : 5 onglets — Demandes | Écoles | Stats | Réglages | Changer
- **AdminPrincipal** : user dont `uid == ecoles.adminUid`
- **Co-admin** : user dont `uid` est dans `ecoles.coAdmins[]`
- **Professeur / Élève / Parent** : rôles standards

## Collections Firestore principales
- `users` : profils (uid, email, name, roles[], role, status, ecoleId, coranProgress, groupeId, parents[], **subscriptionEnd**)
  - `subscriptionEnd` : Firestore Timestamp — abonnement Islam actif si `subscriptionEnd > now()`
- `ecoles` : (nom, adminUid, coAdmins[], createdAt)
- `groupes` : halaqas (profUid, profNom, nom, code, membres[]) — ⚠️ PAS `classes`
- `classes`, `emplois`, `bulletins`, `programmes`, `fournitures`, `absences`, `paiements`
- `videoRooms/{profUid}` : salle vidéo du prof (controls: { muteAllAudio, muteAllVideo })
- `demandesLien` : demandes parent→élève (code 6 chars)
- `agendaProf` : créneaux agenda du prof
- `payments` : paiements PayDunya (token, userId, userEmail, plan, amount, currency, status, provider, createdAt)

## Abonnement Islam (module Premium)
- **Entitlement RevenueCat** : `'sama_doom_pro'` ← (minuscules, underscore)
- **Clés RevenueCat** : iOS `appl_FYyUPCaYzZRIVPjpmnewotyfrAG` / Android `goog_OOArAuCLXtpfmvLVTpuzLJuwtLF`
- **Produits App Store Connect** :
  - Mensuel : `com.mycompany.daara.islam_mensuel` — 6,99 $ USD / mois ✅ confirmé
  - Annuel : `com.mycompany.daara.islam_annuel` — 39,99 $ USD / an ✅ confirmé
- **Produits Google Play** :
  - Mensuel : `com.mycompany.daara.islam_mensuel` — 3 500 FCFA/mois
  - Annuel : `com.mycompany.daara.islam_annuel` — 24 000 FCFA/an
- **Deux sources d'abonnement** :
  1. **Manuel (SuperAdmin)** : `users/{uid}.subscriptionEnd` (Timestamp Firestore)
  2. **IAP RevenueCat** : entitlement actif dans `getCustomerInfo()`
- `checkSubscription()` dans `src/services/iap.js` vérifie les deux sources (Firestore d'abord)
- **`initRevenueCat`** enveloppé dans try/catch — silencieux si module natif absent
- `react-native-purchases` : chargement dynamique via `require()` (pas d'import statique)
- **⚠️ NE JAMAIS ajouter `react-native-purchases` dans `app.json` plugins**

### RevenueCat — Configuration vérifiée ✅ (06/11/2026)
- Entitlement `sama_doom_pro` → 6 produits liés (entlf165e16291) :
  - `com.mycompany.daara.islam_mensuel` (SamaDoom app)
  - `com.mycompany.daara.islam_annuel` (SamaDoom app)
  - `com.mycompany.daara.islam_mensuel:p1m` (SDK v6 format)
  - `com.mycompany.daara.islam_annuel:p1y` (SDK v6 format)
  - Monthly + Yearly (Test Store — app de test, sans impact)
- Offering "default" : package $rc_monthly → `islam_mensuel`, package $rc_annual → `islam_annuel`
- Code `AbonnementScreen.js` cherche par `packageType === 'MONTHLY'` / `'ANNUAL'` ✅ cohérent
- Project ID RevenueCat : `40327083` / App Store Connect App ID : `6739324174`

### iOS — PayDunya BLOQUÉ (règle Apple 3.1.1)
- Sur iOS, PayDunya est interdit — seul Apple Pay (RevenueCat IAP) est autorisé
- `AbonnementScreen.js` : bloc `if (Platform.OS === 'ios')` → Alert "Paiement Apple indisponible" → return
- PayDunya reste disponible sur Android uniquement (fallback Option C)
- Prix fallback affichés : mensuel `'6,99 $'`, annuel `'39,99 $'`

### SuperAdmin — don / révocation d'abonnement
- **Don** : `updateDoc(doc(db,'users',uid), { subscriptionEnd: Timestamp.fromDate(endDate) })`
- **Révocation** : `updateDoc(doc(db,'users',uid), { subscriptionEnd: null })`
- Règle Firestore : `isSuperAdmin()` peut faire `update` avec `affectedKeys().hasOnly(['subscriptionEnd'])`
- **`isSuperAdmin()`** dans `firestore.rules` : vérifie `role == 'superadmin'` OR `'superadmin' in roles`
- ⚠️ Ne pas utiliser `isAdmin()` (vérifie `isAdmin == true`, différent de SuperAdmin)

## Firestore Rules — points importants
- `isAdmin()` : vérifie `users/{uid}.isAdmin == true`
- `isSuperAdmin()` : vérifie `role == 'superadmin'` OU `'superadmin' in roles`
- Règle SuperAdmin `subscriptionEnd` : `allow update: if isSuperAdmin() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['subscriptionEnd'])`
- Après toute modif rules : **`firebase deploy --only firestore:rules`**

## Module Vidéo Agora (`src/screens/`)
- `eleve/EleveVideoCall.js` : rejoint canal Agora du prof (depuis `videoRooms/{profUid}`)
  - Preview caméra locale dès l'init (`startPreview()` immédiat)
  - Contrôle micro/cam par prof via Firestore `controls`
- `professeur/ProfVideoCall.js` : lobby + channel host
  - Contrôle élèves (muteAllAudio/muteAllVideo via Firestore)
  - Partage d'écran (`ScreenCaptureParameters2` API)
- `src/config/agora.js` : `AGORA_APP_ID = 'fa1b8525b15f4ab7a48ba7899898fc22'`
- Permissions Android requises (dans `app.json`) : CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, BLUETOOTH, BLUETOOTH_CONNECT, READ_PHONE_STATE

## Module Coran (`src/screens/coran/`)
- Audio CDN : `https://cdn.islamic.network/quran/audio/128/{edition}/{globalNum}.mp3`
- Bismillah joué avant sourates 2-114 sauf 9 (via `playingBismillahRef`)
- Mot-à-mot modal : ✕ top-right, ordre RTL (`flexDirection: 'row-reverse'`)
- **Progression prof** : `markProfValidation` et `markVerse` (mode prof) utilisent `updateDoc` avec dot notation
  (`coranProgress.${surahKey}.profValidation`) au lieu de `setDoc+merge` → règle Firestore `hasOnly(['coranProgress'])` OK

## Module Progrès Coran (`src/screens/eleve/MesProgresScreen.js`)
- Accepte `eleveUid` + `eleveNom` en route params → affiche la progression d'un autre utilisateur
- Titre dynamique : "Mes Progrès" (soi) ou "Progrès de [nom]" (parent/prof)
- Données dans `users/{targetUid}.coranProgress` (onSnapshot temps réel)
- Barre progression : `done / SURAH_VERSE_COUNTS[surahNum - 1]` (vraies longueurs)
- Sourates cliquables → navigate `SurahDetail` (avec eleveUid si mode viewing)

## Module Halaqa élève (`src/screens/eleve/MaHalaqaScreen.js`)
- Nouvel écran : affiche membres de la halaqa + % progression Coran de chaque élève
- Accessible depuis EleveDashboard card "🕌 Ma Halaqa" (visible quand `groupeInfo` existe)
- Route `MaHalaqa` enregistrée dans les 3 stacks (Eleve, Parent, Prof) dans AppNavigator

## Module Prières (`src/screens/shared/HorairePrieresScreen.js`)
- Design : vert sombre `#0D3320` + or `#C9A84C`
- Source : `api.aladhan.com` (méthodes 3/5/21)
- 3 onglets : Aujourd'hui | Semaine | **Qibla**
- Qibla : bearing vers La Mecque (21.4225°N, 39.8262°E), boussole LIVE via `watchHeadingAsync`
- Bouton vers `CalendrierIslamique` dans le scroll

## Module Calendrier islamique (`src/screens/shared/CalendrierIslamiqueScreen.js`)
- Date hijri du jour (algo Kuwaiti grégorien→hijri)
- 5 décomptes : Ramadan, Aïd al-Fitr, Tabaski, Nouvel An islamique, Mawlid
- Calendrier mensuel hijri navigable

## EleveDashboard QuickCards (ordre actuel)
Coran · Prières · Mes Progrès · Islam Pratique · Hadiths · Invocations · Histoires · **Quiz** (dernier)
+ **Ma Halaqa** (visible si `groupeInfo` existe) + **Cours vidéo** (si `groupeInfo.profUid`)

## Navigation — CalendrierIslamique enregistré dans
- EleveTabs, ParentTabs, ProfTabs → `navigation.navigate('CalendrierIslamique')`

## Lien Parent ↔ Élève
- L'admin lie le parent à l'élève via Admin → Élèves → Dossier élève → section "Parents" → email du parent
- Cela stocke `parentUid` dans `users/{eleveId}.parents[]` (tableau d'UIDs)
- `ParentDashboard` charge les enfants via `where('parents', 'array-contains', uid)`
- Bouton "Progrès élève" passe `eleveUid` + `eleveNom` de l'enfant sélectionné à MesProgresScreen
- Lien alternatif : élève scanne/saisit code 6 chars → `demandesLien` → accepte → `arrayUnion(parentUid)`

## OTA (EAS Update)
- `eas update --branch production --message "..."`
- OTA = changements JS seulement (pas de nouvelles permissions natives, pas de changements natifs)
- Appliqué au 2e lancement de l'app
- **⚠️ OTA ne peut PAS corriger un crash natif** — si l'app crashe avant que le JS se charge, l'OTA ne sera jamais téléchargée

---

## État builds

- Builds 55-61 : TOUS échoués (permissions Android Agora manquantes)
- Build 62 (Android) : ✅ SUCCESS après ajout permissions CAMERA, RECORD_AUDIO, etc.
- iOS build 59 : ✅ SUCCESS (Agora déjà inclus)
- Builds iOS 63-65 : ❌ ÉCHOUÉS — Xcode 15 (ancienne image) incompatible avec RN 0.81.5
- **eas.json** : image `macos-sequoia-15.6-xcode-26.0` (SDK 54, Xcode 26 — requis Apple Store depuis avril 2026)
- **Build iOS 70 (v2.4.2)** : ✅ buildé et soumis à Apple — ❌ **REFUSÉ** (voir historique App Store Review)
- **Build iOS 80 (v2.4.3)** : ✅ le dernier build qui fonctionnait (avant Xcode 26 obligatoire)
- **Builds 81-88** : ❌ tous échoués — erreur Swift 6 avec react-native-purchases v9
- **Build 89 (v2.4.3)** : ✅ BUILD OK (react-native-purchases 10.10.0) — ❌ crash au démarrage
- **Builds 90-91** : ❌ erreur Swift 6 (tentatives de fix SWIFT_VERSION échouées)
- **Builds 92-96** : ❌ échoués — résolution progressive du problème react-native-purchases
- **Build 97 (v2.4.3)** : ✅ **SUCCÈS** — react-native-purchases résolu, build validé, soumis à Apple le 08/11/2026

## EAS Build — image iOS correcte
```json
"ios": {
  "image": "latest"
}
```
- Image officielle EAS pour SDK 54 (alias `latest` → Xcode 26.0)
- Apple exige Xcode 26+ pour soumissions App Store depuis le 28 avril 2026

---

## ✅ App Store Connect — Soumission du 08/11/2026

**Statut** : **"4 éléments envoyés"** ✅ — En attente de vérification Apple

### Ce qui a été soumis ensemble
1. **App 2.4.3 (Build 97)** — nouvelle version iOS
2. **Groupe d'abonnements SamaDoom Pro** — groupe soumis pour la 1re fois
3. **Abonnement Mensuel** (`com.mycompany.daara.islam_mensuel`) — 6,99 $/mois
4. **Abonnement Annuel** (`com.mycompany.daara.islam_annuel`) — 39,99 $/an

> **Note Apple** : La première soumission d'un groupe d'abonnements DOIT se faire avec une version d'app. Les abonnements ne peuvent pas être soumis seuls.

### Corrections appliquées avant soumission
- ✅ **Guideline 3.1.2 (CLUF)** : EULA ajouté dans App Store Connect
- ✅ **Guideline 2.3.10 (référence Google Play)** : supprimée dans `src/services/iap.js` (JSDoc)
- ✅ **Guideline 2.3.2 (images IAP)** : anciennes images bloquées supprimées
- ✅ **Guideline 2.1.0 (nouveau build requis)** : build 97 soumis

### Images promotionnelles abonnements (⏳ EN ATTENTE)
- Les images 1024×1024 n'ont pas pu être uploadées (erreur serveur Apple au moment de la soumission)
- Elles sont **optionnelles** et peuvent être ajoutées après validation
- Images disponibles :
  - Annuel : `8f37ae27-image.png` — dégradé violet/orange (1024×1024)
  - Mensuel : `033dcba6-image.png` — dégradé bleu (1024×1024)
- **ACTION** : Dès que la soumission est traitée → uploader les images dans les fiches abonnement

---

## Google OAuth
- Android redirect : `com.googleusercontent.apps.471912967633-tmbrtoh0mjlakqm7kubsh5r9gftngngb:/oauth2redirect/google`
- GCC : Android client → Paramètres avancés → URI personnalisé activé
- Désactivé dans Expo Go (`IS_EXPO_GO = Constants.appOwnership === 'expo'`)
- **OAuth Consent Screen** (Google Cloud Console → projet `amnafj-3f7dd`) :
  - Nom application changé de `project-471912967633` → **`Sama Doom`** ✅ (sauvegardé le 01/11/2026)
  - Email développeur ajouté : `support@freejobla.com`

## Chemin prof → progression élève
- ProfDashboard → Ma Halaqa privée → GestionGroupe → clic élève → ProfStudentSurahs → SurahDetail (avec eleveUid)
- Dans SurahDetail : bouton ✓ bleu (profValidation) enregistré via `updateDoc` dot notation

## Fichiers clés
- `src/navigation/AppNavigator.js` — navigation principale
- `src/context/AuthContext.js` — auth + rôles
- `src/context/AdminContext.js` — écoles + isPrincipal
- `src/config/agora.js` — App ID Agora
- `src/services/iap.js` — RevenueCat + vérification abonnement (Firestore + IAP)
- `src/screens/eleve/EleveDashboard.js` — QuickCards élève
- `src/screens/eleve/AbonnementScreen.js` — écran abonnement Islam (affiche date fin si manuel)
- `src/screens/eleve/MaHalaqaScreen.js` — vue halaqa de l'élève (membres + progressions)
- `src/screens/eleve/EleveVideoCall.js` — appel vidéo élève (Agora)
- `src/screens/eleve/MesProgresScreen.js` — progression Coran (soi ou élève via params)
- `src/screens/professeur/ProfVideoCall.js` — appel vidéo prof (Agora)
- `src/screens/professeur/GestionGroupeScreen.js` — gestion halaqa + liste élèves
- `src/screens/coran/ProfStudentSurahs.js` — liste sourates d'un élève (vue prof)
- `src/screens/coran/SurahDetailScreen.js` — lecteur Coran + markVerse + markProfValidation
- `src/screens/shared/HorairePrieresScreen.js` — prières + boussole live + Qibla
- `src/screens/shared/CalendrierIslamiqueScreen.js` — calendrier hijri
- `src/screens/admin/AdminDashboard.js` — dashboard admin
- `src/screens/superadmin/SuperAdminDashboard.js` — dashboard SuperAdmin (don + révocation abonnement, KeyboardAvoidingView)
- `src/screens/superadmin/SuperAdminStats.js` — stats cliquables → navigue vers onglet Demandes
- `app.json`, `eas.json`, `firestore.rules`
- `plugins/withIosDeploymentTarget.js` — fix deployment target 15.1

## Points importants
- Stats dashboard filtrées par `ecoleId` (pas `adminUid`)
- Co-admins : écriture sur `ecoles.coAdmins[]` uniquement
- Fix lettre ع (Alphabet arabe) dans EleveDashboard : **pas encore fait**
- GitHub repo : `laminendao2/SamaDoom` (privé)
- Halaqas dans collection `groupes` (⚠️ PAS `classes`)
- Règle Firestore prof→élève : `hasOnly(['coranProgress'])` → toujours utiliser `updateDoc` + dot notation
- Recherche utilisateur par nom (prefix) : utiliser `q + ''` pour range query Firestore

## Commandes utiles
```bash
npx expo start
eas update --branch production --message "description"
firebase deploy --only firestore:rules
eas build --platform android --profile production
eas build --platform ios --profile production --non-interactive
```

---

## Application Web — samadoom-web (Next.js)
- **Repo GitHub** : `laminendao2/samadoom-web` (privé)
- **URL production** : `https://samadoom.com`
- **Hébergement** : Vercel (déploiement automatique depuis `main`)
- **Stack** : Next.js 14 (App Router, TypeScript), Tailwind CSS, Firebase Admin SDK

### Variables d'environnement Vercel (production)
- `PAYDUNYA_MODE=live`
- `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_PUBLIC_KEY`, `PAYDUNYA_TOKEN` — clés live PayDunya
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firebase Admin
- `NEXT_PUBLIC_SITE_URL=https://samadoom.com`

### PayDunya — intégration complète (commit fb3c954)
- **Application PayDunya** : "Sama Doom" — **mode live activé** (Statut : Activée ✅)
- **API live** : `https://app.paydunya.com/api/v1`
- **Checkout live** : `https://app.paydunya.com/checkout/invoice/{token}`
- **⚠️ Sandbox checkout cassé** — toujours utiliser le mode live en production

### Routes API PayDunya (`src/app/api/paydunya/`)
| Route | Usage |
|-------|-------|
| `POST /api/paydunya/create-invoice` | Web — créer facture, retourne `checkoutUrl` |
| `POST /api/paydunya/callback` | Webhook PayDunya → active `isPro` dans Firestore |
| `POST /api/paydunya/mobile-invoice` | iOS/Android — auth Firebase ID token |
| `GET /api/paydunya/payment-status?token=` | iOS/Android — polling statut paiement |

### Flux de paiement web
1. User clique "Choisir Mensuel/Annuel" sur `/abonnement`
2. Page appelle `POST /api/paydunya/create-invoice` avec `{ plan, userId, userEmail }`
3. API crée la facture PayDunya + enregistre doc `payments/{token}` en Firestore (status: pending)
4. User redirigé vers `checkoutUrl` PayDunya (Orange Money, Wave, Free Money, etc.)
5. PayDunya appelle `POST /api/paydunya/callback` → met à jour `payments/{token}.status` + active `users/{userId}.isPro = true`
6. User redirigé vers `/abonnement/success?plan=...`

### Plans et tarifs
| Plan | Prix | Durée |
|------|------|-------|
| mensuel | 3 000 FCFA | 1 mois |
| annuel | 24 000 FCFA | 12 mois |

### Fichiers clés samadoom-web
- `src/app/(dashboard)/abonnement/page.tsx` — page abonnement avec boutons de paiement
- `src/app/(dashboard)/abonnement/success/page.tsx` — page de confirmation post-paiement
- `src/app/api/paydunya/create-invoice/route.ts` — création facture (web)
- `src/app/api/paydunya/callback/route.ts` — webhook PayDunya
- `src/app/api/paydunya/mobile-invoice/route.ts` — facture mobile (auth Firebase)
- `src/app/api/paydunya/payment-status/route.ts` — statut paiement mobile
- `src/lib/firebase-admin.ts` — Firestore Admin SDK (partagé par toutes les routes)
- `src/context/AuthContext.tsx` — auth Firebase + profil user (`isPro`, `subscriptionEnd`)
