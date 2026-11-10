import React, { useEffect, useState } from 'react';
import { Platform, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';

SplashScreen.preventAutoHideAsync().catch(() => {});

if (!__DEV__) {
  (async () => {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (_) {}
  })();
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={s.center}>
          <Text style={s.errTitle}>Erreur de chargement</Text>
          <Text style={s.errMsg}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a1628', padding: 20 },
  spinner:  { marginBottom: 16 },
  loadText: { color: '#4CAF50', fontSize: 16 },
  errTitle: { color: '#ff4444', fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  errMsg:   { color: '#ffcccc', fontSize: 13, textAlign: 'center', fontFamily: 'monospace' },
});

export default function App() {
  const [ready, setReady] = useState(false);
  const [AppNavigator, setAppNavigator] = useState(null);
  const [AuthProvider, setAuthProvider] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const i18nMod = require('./src/i18n');
        const storedLang = await i18nMod.loadStoredLanguage();
        await i18nMod.changeLanguage(storedLang);
      } catch (e) { console.warn('[App] i18n error:', e); }

      try {
        const nav  = require('./src/navigation/AppNavigator').default;
        const auth = require('./src/context/AuthContext').AuthProvider;
        setAppNavigator(() => nav);
        setAuthProvider(() => auth);
      } catch (e) {
        console.error('[App] Module load error:', e);
        setLoadError(e?.message || String(e));
      }

      await SplashScreen.hideAsync().catch(() => {});

      if (Platform.OS === 'ios') {
        setTimeout(async () => {
          try {
            const { requestTrackingPermissionsAsync } = require('expo-tracking-transparency');
            await requestTrackingPermissionsAsync();
          } catch (_) {}
        }, 300);
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4CAF50" style={s.spinner} />
        <Text style={s.loadText}>Chargement...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={s.center}>
        <Text style={s.errTitle}>Erreur de chargement</Text>
        <Text style={s.errMsg}>{loadError}</Text>
      </View>
    );
  }

  if (!AppNavigator || !AuthProvider) {
    return (
      <View style={s.center}>
        <Text style={s.errTitle}>Erreur : modules non chargés</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
