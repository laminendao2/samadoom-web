import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import VoiceAssistant from '../components/VoiceAssistant';
import { setupNotificationHandler } from '../services/prayerNotifications';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { signOut } from 'firebase/auth';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { auth } from '../firebase/config';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { AdminProvider } from '../context/AdminContext';
import SwitchRoleScreen from '../screens/auth/SwitchRoleScreen';

// Auth screens
import WelcomeScreen    from '../screens/auth/WelcomeScreen';
import LoginScreen      from '../screens/auth/LoginScreen';
import IslamPublicScreen from '../screens/auth/IslamPublicScreen';
import RolePickerScreen from '../screens/auth/RolePickerScreen';

// Role dashboards
import EleveDashboard from '../screens/eleve/EleveDashboard';
import ParentDashboard from '../screens/parent/ParentDashboard';
import ProfDashboard   from '../screens/professeur/ProfDashboard';
import AdminDashboard    from '../screens/admin/AdminDashboard';
import AdminEleves       from '../screens/admin/AdminEleves';
import AdminClasses      from '../screens/admin/AdminClasses';
import AdminBulletins    from '../screens/admin/AdminBulletins';
import AdminProfesseurs  from '../screens/admin/AdminProfesseurs';
import AdminAbsences     from '../screens/admin/AdminAbsences';
import AdminPaiements    from '../screens/admin/AdminPaiements';
import AdminReglages        from '../screens/admin/AdminReglages';
import AdminProfile         from '../screens/admin/AdminProfile';
import UserProfileScreen       from '../screens/shared/UserProfileScreen';
import EleveEmploiDuTemps      from '../screens/eleve/EleveEmploiDuTemps';
import EleveNotes               from '../screens/eleve/EleveNotes';
import EleveDossier             from '../screens/eleve/EleveDossier';
import EleveAbsencesRetards     from '../screens/eleve/EleveAbsencesRetards';
import EleveExamensDevoirs      from '../screens/eleve/EleveExamensDevoirs';
import EleveExercices           from '../screens/eleve/EleveExercices';
import AdminProgrammes      from '../screens/admin/AdminProgrammes';
import AdminEmploiDuTemps   from '../screens/admin/AdminEmploiDuTemps';
import AdminEleveDossier    from '../screens/admin/AdminEleveDossier';
import ClasseDetailScreen   from '../screens/admin/ClasseDetailScreen';
import SuperAdminDashboard      from '../screens/superadmin/SuperAdminDashboard';
import SuperAdminEtablissements from '../screens/superadmin/SuperAdminEtablissements';
import SuperAdminSettings       from '../screens/superadmin/SuperAdminSettings';
import SuperAdminStats          from '../screens/superadmin/SuperAdminStats';
import SuperAdminIslamScreen    from '../screens/superadmin/SuperAdminIslamScreen';
import ActualitesScreen         from '../screens/shared/ActualitesScreen';
import HorairePrieresScreen      from '../screens/shared/HorairePrieresScreen';
import SonNotificationScreen     from '../screens/shared/SonNotificationScreen';
import PaiementEnLigneScreen      from '../screens/shared/PaiementEnLigneScreen';
import AdminAnnonces            from '../screens/admin/AdminAnnonces';
import AdminGestionAdmins      from '../screens/admin/AdminGestionAdmins';

// Coran screens
import CoranScreen           from '../screens/coran/CoranScreen';
import SurahListScreen       from '../screens/coran/SurahListScreen';
import SurahDetailScreen     from '../screens/coran/SurahDetailScreen';
import ProfCoranSuivi        from '../screens/coran/ProfCoranSuivi';
import ProfCoranObjectif     from '../screens/coran/ProfCoranObjectif';
import ProfStudentSurahs     from '../screens/coran/ProfStudentSurahs';
import ParentCoranSuivi      from '../screens/coran/ParentCoranSuivi';
import ArabicAlphabetScreen  from '../screens/coran/ArabicAlphabetScreen';
import IslamPratiqueScreen       from '../screens/coran/IslamPratiqueScreen';
import PriereApprendreScreen    from '../screens/coran/PriereApprendreScreen';
import IslamPratiqueDetailScreen from '../screens/coran/IslamPratiqueDetailScreen';
import HadithDetailScreen        from '../screens/coran/HadithDetailScreen';
import InvocationsDetailScreen  from '../screens/coran/InvocationsDetailScreen';
import ProphetDetailScreen        from '../screens/coran/ProphetDetailScreen';
import InvocationsScreen     from '../screens/coran/InvocationsScreen';
import HadithsScreen            from '../screens/coran/HadithsScreen';
import HistoiresProphetesScreen from '../screens/coran/HistoiresProphetesScreen';
import QuizIslamiqueScreen      from '../screens/coran/QuizIslamiqueScreen';
import MesProgresScreen         from '../screens/eleve/MesProgresScreen';
import AbonnementScreen         from '../screens/eleve/AbonnementScreen';
import FAQScreen                from '../screens/shared/FAQScreen';
import MaHalaqaScreen           from '../screens/eleve/MaHalaqaScreen';
import CalendrierIslamiqueScreen from '../screens/shared/CalendrierIslamiqueScreen';
import GestionGroupeScreen    from '../screens/professeur/GestionGroupeScreen';
import ProfAgendaScreen       from '../screens/professeur/ProfAgendaScreen';
import EleveAgendaProf        from '../screens/eleve/EleveAgendaProf';
import ProfVideoCall          from '../screens/professeur/ProfVideoCall';
import EleveVideoCall         from '../screens/eleve/EleveVideoCall';
import RejoindreGroupeScreen  from '../screens/shared/RejoindreGroupeScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Tab navigators par rôle ──────────────────────────────────────────────────

const SWITCH_OPTS = { title: 'Changer', tabBarIcon: () => <TabIcon icon="🔄" /> };

function EleveTabsInner() {
  return (
    <Tab.Navigator screenOptions={tabOptions(COLORS.eleve)}>
      <Tab.Screen name="EleveDash"    component={EleveDashboard}   options={{ title: 'Accueil',    tabBarIcon: () => <TabIcon icon="🏠" /> }} />
      <Tab.Screen name="Actualites"   component={ActualitesScreen} options={{ title: 'Actualités', tabBarIcon: () => <TabIcon icon="📢" /> }} />
      <Tab.Screen name="SwitchRole"   component={SwitchRoleScreen} options={SWITCH_OPTS} />
    </Tab.Navigator>
  );
}

function EleveTabs() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EleveTabsMain"        component={EleveTabsInner} />
      <Stack.Screen name="UserProfile"          component={UserProfileScreen} />
      <Stack.Screen name="EleveEmploiDuTemps"   component={EleveEmploiDuTemps} />
      <Stack.Screen name="EleveNotes"           component={EleveNotes} />
      <Stack.Screen name="EleveDossier"         component={EleveDossier} />
      <Stack.Screen name="EleveAbsencesRetards" component={EleveAbsencesRetards} />
      <Stack.Screen name="EleveExamensDevoirs"  component={EleveExamensDevoirs} />
      <Stack.Screen name="EleveExercices"       component={EleveExercices} />
      <Stack.Screen name="AdminAnnonces"        component={AdminAnnonces} />
      <Stack.Screen name="SurahList"            component={SurahListScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SurahDetail"          component={SurahDetailScreen}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ArabicAlphabet"       component={ArabicAlphabetScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="IslamPratique"        component={IslamPratiqueScreen}       options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PriereApprendre"     component={PriereApprendreScreen}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="IslamPratiqueDetail" component={IslamPratiqueDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Invocations"          component={InvocationsScreen}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="InvocationsDetail"   component={InvocationsDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Hadiths"              component={HadithsScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HadithDetail"         component={HadithDetailScreen}   options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProphetDetail"       component={ProphetDetailScreen}  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HistoiresProphetes"  component={HistoiresProphetesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="QuizIslamique"       component={QuizIslamiqueScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HorairePrieres"       component={HorairePrieresScreen}     options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="SonNotification"       component={SonNotificationScreen}    options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="PaiementEnLigne"       component={PaiementEnLigneScreen}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="MesProgres"          component={MesProgresScreen}         options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="FAQ"               component={FAQScreen}                options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="Abonnement"         component={AbonnementScreen}         options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="MaHalaqa"             component={MaHalaqaScreen}           options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CalendrierIslamique"  component={CalendrierIslamiqueScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="RejoindreGroupe"     component={RejoindreGroupeScreen}  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="EleveAgendaProf"   component={EleveAgendaProf}      options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="EleveVideoCall"   component={EleveVideoCall}        options={{ animation: 'slide_from_right', headerShown: false }} />
    </Stack.Navigator>
  );
}

function ParentTabsInner() {
  return (
    <Tab.Navigator screenOptions={tabOptions(COLORS.parent)}>
      <Tab.Screen name="ParentDash"  component={ParentDashboard}  options={{ title: 'Accueil',    tabBarIcon: () => <TabIcon icon="🏠" /> }} />
      <Tab.Screen name="Actualites"  component={ActualitesScreen} options={{ title: 'Actualités', tabBarIcon: () => <TabIcon icon="📢" /> }} />
      <Tab.Screen name="SwitchRole"  component={SwitchRoleScreen} options={SWITCH_OPTS} />
    </Tab.Navigator>
  );
}

function ParentTabs() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ParentTabsMain"   component={ParentTabsInner} />
      <Stack.Screen name="UserProfile"      component={UserProfileScreen} />
      <Stack.Screen name="AdminAnnonces"    component={AdminAnnonces} />
      <Stack.Screen name="SurahList"        component={SurahListScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SurahDetail"      component={SurahDetailScreen}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ParentCoranSuivi" component={ParentCoranSuivi}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ArabicAlphabet"   component={ArabicAlphabetScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="IslamPratique"        component={IslamPratiqueScreen}       options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PriereApprendre"     component={PriereApprendreScreen}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="IslamPratiqueDetail" component={IslamPratiqueDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Invocations"      component={InvocationsScreen}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="InvocationsDetail" component={InvocationsDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Hadiths"          component={HadithsScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HadithDetail"     component={HadithDetailScreen}   options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProphetDetail"   component={ProphetDetailScreen}  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HistoiresProphetes"  component={HistoiresProphetesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="QuizIslamique"       component={QuizIslamiqueScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HorairePrieres"       component={HorairePrieresScreen}     options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="SonNotification"       component={SonNotificationScreen}    options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="PaiementEnLigne"       component={PaiementEnLigneScreen}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="MesProgres"          component={MesProgresScreen}         options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="FAQ"               component={FAQScreen}                options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="Abonnement"         component={AbonnementScreen}         options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="MaHalaqa"             component={MaHalaqaScreen}           options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CalendrierIslamique"  component={CalendrierIslamiqueScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="RejoindreGroupe"     component={RejoindreGroupeScreen}  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="EleveAgendaProf"   component={EleveAgendaProf}      options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="EleveVideoCall"   component={EleveVideoCall}        options={{ animation: 'slide_from_right', headerShown: false }} />
    </Stack.Navigator>
  );
}

function ProfTabsInner() {
  return (
    <Tab.Navigator screenOptions={tabOptions(COLORS.professeur)}>
      <Tab.Screen name="ProfDash"   component={ProfDashboard}    options={{ title: 'Accueil',    tabBarIcon: () => <TabIcon icon="🏠" /> }} />
      <Tab.Screen name="Actualites" component={ActualitesScreen} options={{ title: 'Actualités', tabBarIcon: () => <TabIcon icon="📢" /> }} />
      <Tab.Screen name="SwitchRole" component={SwitchRoleScreen} options={SWITCH_OPTS} />
    </Tab.Navigator>
  );
}

function ProfTabs() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfTabsMain"      component={ProfTabsInner} />
      <Stack.Screen name="UserProfile"       component={UserProfileScreen} />
      <Stack.Screen name="AdminAnnonces"     component={AdminAnnonces} />
      <Stack.Screen name="SurahList"          component={SurahListScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SurahDetail"       component={SurahDetailScreen}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProfCoranSuivi"    component={ProfCoranSuivi}       options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProfCoranObjectif" component={ProfCoranObjectif}    options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="ProfAgenda"        component={ProfAgendaScreen}     options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="EleveAgendaProf"   component={EleveAgendaProf}      options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="ProfVideoCall"    component={ProfVideoCall}         options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="EleveVideoCall"   component={EleveVideoCall}        options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="ProfStudentSurahs" component={ProfStudentSurahs}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ArabicAlphabet"    component={ArabicAlphabetScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="IslamPratique"        component={IslamPratiqueScreen}       options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PriereApprendre"     component={PriereApprendreScreen}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="IslamPratiqueDetail" component={IslamPratiqueDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Invocations"       component={InvocationsScreen}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="InvocationsDetail"  component={InvocationsDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Hadiths"           component={HadithsScreen}        options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HadithDetail"      component={HadithDetailScreen}   options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ProphetDetail"    component={ProphetDetailScreen}  options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HistoiresProphetes"  component={HistoiresProphetesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="QuizIslamique"       component={QuizIslamiqueScreen}      options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="HorairePrieres"       component={HorairePrieresScreen}     options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="SonNotification"       component={SonNotificationScreen}    options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="PaiementEnLigne"       component={PaiementEnLigneScreen}     options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="MesProgres"          component={MesProgresScreen}         options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="FAQ"               component={FAQScreen}                options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="Abonnement"         component={AbonnementScreen}         options={{ animation: 'slide_from_right', headerShown: false }} />
      <Stack.Screen name="MaHalaqa"             component={MaHalaqaScreen}           options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CalendrierIslamique"  component={CalendrierIslamiqueScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="GestionGroupe"       component={GestionGroupeScreen}    options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="RejoindreGroupe"     component={RejoindreGroupeScreen}  options={{ animation: 'slide_from_right' }} />
    </Stack.Navigator>
  );
}

function AdminHome() {
  return (
    <Tab.Navigator screenOptions={tabOptions(COLORS.admin)}>
      <Tab.Screen name="AdminDash"  component={AdminDashboard}   options={{ title: 'Accueil',    tabBarIcon: () => <TabIcon icon="🏠" /> }} />
      <Tab.Screen name="Actualites" component={ActualitesScreen} options={{ title: 'Actualités', tabBarIcon: () => <TabIcon icon="📢" /> }} />
      <Tab.Screen name="SwitchRole" component={SwitchRoleScreen} options={SWITCH_OPTS} />
    </Tab.Navigator>
  );
}

function AdminTabs() {
  return (
    <AdminProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminHome"          component={AdminHome} />
        <Stack.Screen name="AdminEleves"        component={AdminEleves} />
        <Stack.Screen name="AdminClasses"       component={AdminClasses} />
        <Stack.Screen name="AdminBulletins"     component={AdminBulletins} />
        <Stack.Screen name="AdminProfesseurs"   component={AdminProfesseurs} />
        <Stack.Screen name="AdminAbsences"      component={AdminAbsences} />
        <Stack.Screen name="AdminPaiements"     component={AdminPaiements} />
        <Stack.Screen name="AdminReglages"      component={AdminReglages} />
        <Stack.Screen name="AdminProfile"       component={AdminProfile} />
        <Stack.Screen name="AdminProgrammes"    component={AdminProgrammes} />
        <Stack.Screen name="AdminEmploiDuTemps" component={AdminEmploiDuTemps} />
        <Stack.Screen name="AdminEleveDossier"  component={AdminEleveDossier}  />
        <Stack.Screen name="ClasseDetail"       component={ClasseDetailScreen} />
        <Stack.Screen name="AdminAnnonces"      component={AdminAnnonces} />
        <Stack.Screen name="AdminGestionAdmins" component={AdminGestionAdmins} />
      </Stack.Navigator>
    </AdminProvider>
  );
}

function SuperAdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions(COLORS.superadmin)}>
      <Tab.Screen name="SuperAdminDash"   component={SuperAdminDashboard}      options={{ title: 'Demandes', tabBarIcon: () => <TabIcon icon="🔔" /> }} />
      <Tab.Screen name="SuperAdminEtabs"  component={SuperAdminEtablissements} options={{ title: 'Écoles',   tabBarIcon: () => <TabIcon icon="🏫" /> }} />
      <Tab.Screen name="SuperAdminStats"  component={SuperAdminStats}          options={{ title: 'Stats',    tabBarIcon: () => <TabIcon icon="📊" /> }} />
      <Tab.Screen name="SuperAdminParams" component={SuperAdminSettings}       options={{ title: 'Réglages', tabBarIcon: () => <TabIcon icon="⚙️" /> }} />
      <Tab.Screen name="SuperAdminIslam"  component={SuperAdminIslamScreen}    options={{ title: 'Islam',    tabBarIcon: () => <TabIcon icon="🕌" /> }} />
      <Tab.Screen name="SwitchRole"       component={SwitchRoleScreen}         options={SWITCH_OPTS} />
    </Tab.Navigator>
  );
}

function SuperAdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SuperAdminTabs" component={SuperAdminTabs} />
      <Stack.Screen name="FAQ"            component={FAQScreen}      options={{ animation: 'slide_from_right', headerShown: false }} />
    </Stack.Navigator>
  );
}

const ROLE_TABS = {
  eleve:      EleveTabs,
  parent:     ParentTabs,
  professeur: ProfTabs,
  admin:      AdminTabs,
  superadmin: SuperAdminStack,
};

const tabOptions = (activeColor) => ({
  headerShown: false,
  tabBarActiveTintColor: activeColor,
  tabBarInactiveTintColor: COLORS.textLight,
  tabBarStyle: {
    paddingBottom: 8,
    paddingTop: 6,
    backgroundColor: '#fff',
    borderTopColor: COLORS.border,
    elevation: 12,
    shadowOpacity: 0.1,
  },
  tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
});

function TabIcon({ icon }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}

// ── Écrans de statut ─────────────────────────────────────────────────────────

function PendingApprovalScreen({ onLogout }) {
  const { View: V, Text: T, TouchableOpacity: TO } = require('react-native');
  return (
    <V style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 32 }}>
      <T style={{ fontSize: 56 }}>⏳</T>
      <T style={{ fontSize: 22, fontWeight: '800', color: COLORS.dark, marginTop: 16, textAlign: 'center' }}>Demande en attente</T>
      <T style={{ fontSize: 15, color: COLORS.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
        Votre compte admin est en cours de validation.{'\n'}Vous serez notifié une fois approuvé.
      </T>
      <TO onPress={onLogout} style={{ marginTop: 32, backgroundColor: COLORS.dangerLight, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}>
        <T style={{ color: COLORS.danger, fontWeight: '700' }}>Se déconnecter</T>
      </TO>
    </V>
  );
}

function RejectedScreen({ onLogout }) {
  const { View: V, Text: T, TouchableOpacity: TO } = require('react-native');
  return (
    <V style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, padding: 32 }}>
      <T style={{ fontSize: 56 }}>❌</T>
      <T style={{ fontSize: 22, fontWeight: '800', color: COLORS.dark, marginTop: 16, textAlign: 'center' }}>Demande refusée</T>
      <T style={{ fontSize: 15, color: COLORS.textSecondary, marginTop: 10, textAlign: 'center', lineHeight: 22 }}>
        Votre demande d'accès admin a été refusée.{'\n'}Contactez l'administrateur de l'application.
      </T>
      <TO onPress={onLogout} style={{ marginTop: 32, backgroundColor: COLORS.dangerLight, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 }}>
        <T style={{ color: COLORS.danger, fontWeight: '700' }}>Se déconnecter</T>
      </TO>
    </V>
  );
}

// ── Root navigator ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryPale }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

export default function AppNavigator() {
  // Initialise le handler de notifications (doit être appelé le plus tôt possible)
  setupNotificationHandler();

  const { user, roles, activeRole, setActiveRole, status, loading } = useAuth();

  const RoleTabs = activeRole && ROLE_TABS[activeRole];

  const VOICE_ALLOWED = ['laminendao2@gmail.com'];
  const showVoice = user?.email && VOICE_ALLOWED.includes(user.email);

  return (
    <View style={nav_s.root}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {loading ? (
            <Stack.Screen name="Loading" component={LoadingScreen} />
        ) : !user ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login"   component={LoginScreen}   options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="IslamPublic"       component={IslamPublicScreen}        options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="HorairePrieres"    component={HorairePrieresScreen}     options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="CalendrierIslamique" component={CalendrierIslamiqueScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="SurahList"         component={SurahListScreen}          options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="SurahDetail"       component={SurahDetailScreen}        options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Invocations"       component={InvocationsScreen}        options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="InvocationsDetail" component={InvocationsDetailScreen}  options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="Hadiths"           component={HadithsScreen}            options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="HadithDetail"      component={HadithDetailScreen}       options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="QuizIslamique"     component={QuizIslamiqueScreen}      options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="IslamPratique"     component={IslamPratiqueScreen}      options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="PriereApprendre"  component={PriereApprendreScreen}    options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="IslamPratiqueDetail" component={IslamPratiqueDetailScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="HistoiresProphetes" component={HistoiresProphetesScreen} options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="ProphetDetail"     component={ProphetDetailScreen}      options={{ animation: 'slide_from_right', headerShown: false }} />
          </>
        ) : user && activeRole === 'admin' && status === 'pending' ? (
          <Stack.Screen name="Pending" children={() => <PendingApprovalScreen onLogout={() => { signOut(auth); setActiveRole(null); }} />} />
        ) : user && activeRole === 'admin' && status === 'rejected' ? (
          <Stack.Screen name="Rejected" children={() => <RejectedScreen onLogout={() => { signOut(auth); setActiveRole(null); }} />} />
        ) : !activeRole ? (
          <>
            <Stack.Screen name="RolePicker" component={RolePickerScreen} />
            <Stack.Screen name="Coran"      component={CoranScreen}      options={{ animation: 'slide_from_right' }} />
          </>
        ) : RoleTabs ? (
          <Stack.Screen name="App" component={RoleTabs} />
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login"   component={LoginScreen}   options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Coran"   component={CoranScreen}   options={{ animation: 'slide_from_right' }} />
          </>
        )}
        </Stack.Navigator>
      </NavigationContainer>
      {showVoice && <VoiceAssistant />}
    </View>
  );
}

const nav_s = StyleSheet.create({
  root: { flex: 1 },
});
