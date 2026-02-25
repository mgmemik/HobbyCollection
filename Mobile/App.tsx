import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { configureI18n } from './src/i18n';
import { useEffect, useState } from 'react';
import { LoginScreen } from './src/screens/LoginScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import './src/api/interceptor'; // API interceptor'u import et
import { ToastProvider } from './src/components/ui/Toast';
import * as SplashScreen from 'expo-splash-screen';
import { setupNotificationListeners } from './src/utils/notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function Root() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // i18n'i arka planda başlat (blocking olmasın)
    configureI18n().catch((error) => {
      console.error('i18n initialization error:', error);
    });
    
    // Notification listener'ları kur
    setupNotificationListeners();
    
    // Splash screen'i gizle
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Splash screen gizlenemedi:', e);
      }
    };
    
    // Kısa bir gecikme ile splash screen'i gizle
    const timer = setTimeout(hideSplash, 500);
    
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isAuthenticated ? <AppNavigator /> : <LoginScreen />}
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Root />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
