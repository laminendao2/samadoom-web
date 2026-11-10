import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../../firebase/config';
import { COLORS, SHADOWS, RADIUS } from '../../theme/colors';
import CountryPickerModal from '../../components/CountryPickerModal';
import { useTranslation } from 'react-i18next';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../../i18n';
import { useSubscription } from '../../hooks/useSubscription';

const ROLE_COLORS = {
  eleve:      '#1565C0',
  parent:     '#2E7D32',
  professeur: '#6A1B9A',
  admin:      '#E65100',
  superadmin: '#37474F',
};

const ROLE_LABELS = {
  eleve:      'Élève',
  parent:     'Parent',
  professeur: 'Professeur',
  admin:      'Administrateur',
  superadmin: 'Super Admin',
};

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const [info,       setInfo]       = useState(null);
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [pays,       setPays]       = useState('');
  const [photoURL,   setPhotoURL]   = useState('');
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [uploading,  setUploading]  = useState(false);

  const [showCountry, setShowCountry] = useState(false);
  const [showPwd,    setShowPwd]    = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const { isPro, loading: subLoading } = useSubscription();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    // onSnapshot pour mise à jour en temps réel
    return onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setInfo(d);
        setName(d.name || '');
        setPhone(d.phone_number || '');
        setPays(d.pays || '');
        setPhotoURL(d.photoURL || auth.currentUser?.photoURL || '');
      }
      setLoading(false);
    }, err => { console.warn(err.message); setLoading(false); });
  }, []);

  // Seul l'admin peut modifier la photo — pas d'upload ici pour élève/prof

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Erreur', 'Le nom est requis.'); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        name: name.trim(),
        phone_number: phone.trim(),
        pays: pays.trim(),
      });
      Alert.alert('✅ Enregistré', 'Profil mis à jour.');
    } catch (e) { Alert.alert('Erreur', e.message); }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) { Alert.alert('Erreur', 'Remplis tous les champs.'); return; }
    if (newPwd.length < 6) { Alert.alert('Erreur', 'Au moins 6 caractères.'); return; }
    if (newPwd !== confirmPwd) { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.'); return; }
    setPwdLoading(true);
    try {
      const user       = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPwd);
      Alert.alert('✅ Mot de passe modifié');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); setShowPwd(false);
    } catch (e) {
      const msgs = {
        'auth/wrong-password':     'Mot de passe actuel incorrect.',
        'auth/invalid-credential': 'Mot de passe actuel incorrect.',
        'auth/too-many-requests':  'Trop de tentatives. Réessaie plus tard.',
      };
      Alert.alert('Erreur', msgs[e.code] || e.message);
    }
    setPwdLoading(false);
  };

  const openContact = () => {
    Linking.openURL('mailto:info@freejobla.com?subject=Support%20Sama%20Doom');
  };

  const openSubscriptionManagement = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL(
        'https://apps.apple.com/account/subscriptions'
      );
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Tu vas être déconnecté.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  const role        = info?.role || info?.roles?.[0] || 'eleve';
  const canEditName = !['eleve', 'professeur'].includes(role);
  const roleColor   = ROLE_COLORS[role] || COLORS.primary;
  const roleLabel   = ROLE_LABELS[role]  || role;
  const initials    = (info?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const email       = auth.currentUser?.email || '';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        <LinearGradient colors={[roleColor, roleColor + 'CC']} style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {/* Avatar — lecture seule pour élève/prof, modifiable pour admin */}
          <TouchableOpacity style={styles.avatarWrapper} onPress={canEditName ? () => {} : undefined} disabled={!canEditName}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarBig}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.headerName}>{info?.name || 'Utilisateur'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleLabel}>{roleLabel}</Text>
          </View>
          {info?.classe        ? <Text style={styles.headerSub}>Classe : {info.classe}</Text>      : null}
          {info?.etablissement ? <Text style={styles.headerSub}>{info.etablissement}</Text>        : null}
        </LinearGradient>

        <View style={styles.body}>

          <Text style={styles.sectionTitle}>Informations personnelles</Text>
          <View style={styles.card}>
            <View style={styles.emailRow}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.emailValue}>{email}</Text>
            </View>
            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>Nom complet</Text>
            {canEditName ? (
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ton nom" placeholderTextColor={COLORS.textLight} />
            ) : (
              <View style={[styles.input, styles.inputReadOnly]}>
                <Text style={styles.inputReadOnlyText}>{name}</Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Téléphone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Numéro de téléphone"
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
            />

            {/* Pays uniquement pour les admins — les autres héritent du pays de leur école */}
            {canEditName && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Pays</Text>
                <TouchableOpacity style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => setShowCountry(true)}>
                  <Text style={[{ fontSize: 15 }, !pays && { color: COLORS.textLight }]}>{pays || 'Choisir un pays'}</Text>
                  <Text style={{ color: COLORS.textLight }}>▼</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: roleColor }, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Sécurité</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.toggleRow} onPress={() => setShowPwd(v => !v)}>
              <Text style={styles.toggleLabel}>🔒 Changer le mot de passe</Text>
              <Text style={[styles.toggleChevron, { color: roleColor }]}>{showPwd ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showPwd && (
              <View style={{ marginTop: 12 }}>
                {[
                  { val: currentPwd, set: setCurrentPwd, label: 'Mot de passe actuel', ph: '••••••••' },
                  { val: newPwd,     set: setNewPwd,     label: 'Nouveau mot de passe', ph: '••••••••' },
                  { val: confirmPwd, set: setConfirmPwd, label: 'Confirmer',            ph: '••••••••' },
                ].map((f, i) => (
                  <View key={i}>
                    <Text style={[styles.fieldLabel, i > 0 && { marginTop: 12 }]}>{f.label}</Text>
                    <TextInput style={styles.input} value={f.val} onChangeText={f.set} secureTextEntry placeholder={f.ph} placeholderTextColor={COLORS.textLight} />
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: roleColor, marginTop: 16 }, pwdLoading && { opacity: 0.7 }]}
                  onPress={handleChangePassword}
                  disabled={pwdLoading}
                >
                  {pwdLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Modifier le mot de passe</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>


          {/* ── Section Abonnement ── */}
          {!['admin', 'superadmin', 'professeur'].includes(role) && (
            <>
              <Text style={styles.sectionTitle}>Abonnement</Text>
              <View style={styles.card}>
                {subLoading ? (
                  <ActivityIndicator color={roleColor} />
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 28, marginRight: 10 }}>{isPro ? '⭐' : '🔓'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>
                          {isPro ? 'Plan Pro actif' : 'Plan gratuit'}
                        </Text>
                        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                          {isPro
                            ? 'Accès complet à tout le contenu'
                            : 'Passe à Pro pour débloquer tout'}
                        </Text>
                      </View>
                    </View>

                    {isPro ? (
                      <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: '#B71C1C' }]}
                        onPress={openSubscriptionManagement}
                      >
                        <Text style={styles.saveBtnText}>⚙️ Gérer / Annuler mon abonnement</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: roleColor }]}
                        onPress={() => navigation.navigate('Abonnement')}
                      >
                        <Text style={styles.saveBtnText}>✨ Passer à Pro</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </>
          )}

          {/* ── Section Contact ── */}
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#1565C0' }]}
              onPress={openContact}
            >
              <Text style={styles.saveBtnText}>✉️ Nous contacter</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>{t('language.sectionTitle')}</Text>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>{t('language.appLanguage')}</Text>
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 10 }}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = i18n.language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    onPress={() => changeLanguage(lang.code)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderRadius: RADIUS.md,
                      borderWidth: 2,
                      borderColor: active ? roleColor : COLORS.border,
                      backgroundColor: active ? roleColor + '18' : COLORS.background,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{lang.flag}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? roleColor : COLORS.textSecondary, marginTop: 4 }}>
                      {lang.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>🚪 Se déconnecter</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
      <CountryPickerModal
        visible={showCountry}
        value={pays}
        onSelect={setPays}
        onClose={() => setShowCountry(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: COLORS.background },
  header:            { paddingTop: 56, paddingBottom: 36, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  backBtn:           { position: 'absolute', top: 52, left: 20, padding: 8 },
  backIcon:          { fontSize: 24, color: '#fff' },
  avatarWrapper:     { position: 'relative', marginBottom: 12 },
  avatarImg:         { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)' },
  avatarBig:         { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarText:        { fontSize: 30, fontWeight: '800', color: '#fff' },
  avatarEditBadge:   { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  headerName:        { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge:         { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 4, borderRadius: RADIUS.full, marginBottom: 4 },
  roleLabel:         { color: '#fff', fontSize: 13, fontWeight: '700' },
  headerSub:         { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  body:              { padding: 16 },
  sectionTitle:      { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 10, marginLeft: 4 },
  card:              { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, ...SHADOWS.medium },
  emailRow:          { marginBottom: 12 },
  emailValue:        { fontSize: 14, color: COLORS.text, marginTop: 4 },
  divider:           { height: 1, backgroundColor: COLORS.border, marginBottom: 12 },
  fieldLabel:        { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:             { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background },
  inputReadOnly:     { backgroundColor: COLORS.border, borderColor: 'transparent', justifyContent: 'center' },
  inputReadOnlyText: { fontSize: 15, color: COLORS.textSecondary },
  saveBtn:           { marginTop: 16, height: 46, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  saveBtnText:       { color: '#fff', fontWeight: '700', fontSize: 15 },
  photoRow:          { flexDirection: 'row', alignItems: 'center' },
  photoThumb:        { width: 64, height: 64, borderRadius: 32 },
  photoLabel:        { fontSize: 15, fontWeight: '700', color: COLORS.dark },
  photoSub:          { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  toggleRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel:       { fontSize: 15, fontWeight: '600', color: COLORS.text },
  toggleChevron:     { fontSize: 12, fontWeight: '700' },
  logoutBtn:         { marginTop: 20, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', ...SHADOWS.medium },
  logoutText:        { fontSize: 15, fontWeight: '700', color: COLORS.danger },
});
