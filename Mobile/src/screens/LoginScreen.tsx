import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Image, Switch, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { register, verifyEmail, login } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { Logo } from '../components/Logo';
import { AppNavigator } from '../navigation/AppNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { SupportedLocale, translations } from '../i18n/translations';
import { Ionicons } from '@expo/vector-icons';
import { collectAndSendDeviceInfo } from '../api/deviceInfo';
import { checkNotificationPermissions, requestNotificationPermissions } from '../utils/notifications';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

type Stage = 'email' | 'verify' | 'loggedIn';

export const LoginScreen: React.FC = () => {
  const { t, i18n: i18nInstance } = useTranslation();
  const { colors, toggleTheme, currentTheme } = useTheme();
  const { login: authLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true); // Default: true - kullanıcıyı hatırla
  const [stage, setStage] = useState<Stage>('email');
  const [currentLang, setCurrentLang] = useState<SupportedLocale>('en');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const codeInputRef = useRef<TextInput>(null);

  // Mevcut dili yükle
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const stored = await AsyncStorage.getItem('ui_lang');
        const lang = (stored && translations[stored as SupportedLocale]) 
          ? (stored as SupportedLocale) 
          : (i18nInstance.language as SupportedLocale) || 'en';
        setCurrentLang(lang);
      } catch {
        setCurrentLang(i18nInstance.language as SupportedLocale || 'en');
      }
    };
    loadLanguage();
  }, []);

  // Doğrulama kodu ekranına geçildiğinde input'a focus yap
  useEffect(() => {
    if (stage === 'verify') {
      // Kısa bir gecikme ile focus yap (ekran render olana kadar bekle)
      const timer = setTimeout(() => {
        codeInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  const languageName = (code: SupportedLocale) => {
    const map: Partial<Record<SupportedLocale, string>> = { en: 'English', tr: 'Türkçe' };
    return map[code] || code;
  };

  const handleLanguageChange = async (lang: SupportedLocale) => {
    try {
      setCurrentLang(lang);
      await AsyncStorage.setItem('ui_lang', lang);
      await i18nInstance.changeLanguage(lang);
      setLanguageModalVisible(false);
    } catch (error) {
      console.error('Language change error:', error);
    }
  };

  const onContinue = async () => {
    if (isLoading) return; // Zaten yükleniyorsa tekrar basmayı engelle
    
    if (!email.trim()) {
      alert(t('auth.emailRequired') || 'Email adresi gereklidir');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register(email);
      if (res?.message) {
        // Mail gönderildi, doğrulama kodunu girin
        setStage('verify');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onResendCode = async () => {
    if (isLoading) return; // Zaten yükleniyorsa tekrar basmayı engelle
    
    if (!email.trim()) {
      alert(t('auth.emailRequired') || 'Email adresi gereklidir');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register(email);
      if (res?.message) {
        alert(t('auth.codeResent') || 'Doğrulama kodu tekrar gönderildi');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyAndLogin = async () => {
    if (isLoading) return; // Zaten yükleniyorsa tekrar basmayı engelle
    
    if (!code.trim()) {
      alert(t('auth.codeRequired') || 'Doğrulama kodu gereklidir');
      return;
    }

    setIsLoading(true);
    try {
      // Uygulama sürümünü al (deviceInfo.ts ile tutarlı olmalı)
      // Android'de Application.nativeApplicationVersion bazen null dönebilir, bu yüzden Constants.expoConfig?.version kullanıyoruz
      const appVersion = Constants.expoConfig?.version || Application.nativeApplicationVersion || undefined;
      
      // verifyEmail zaten token döndürüyor, login'e gerek yok
      const res = await verifyEmail(email, code, appVersion);
      
      // Sürüm kontrolü - eğer güncelleme gerekiyorsa
      if (res.requiresUpdate) {
        setIsLoading(false);
        alert(
          t('auth.updateRequired') || 'Uygulamanızın güncel sürümü yok. Lütfen uygulamayı güncelleyin.',
          [
            {
              text: t('common.ok') || 'Tamam',
              style: 'default',
            },
          ]
        );
        return;
      }
      
      if (res.accessToken) {
        await authLogin(res.accessToken, email, remember);
        
        // Yeni kullanıcı için otomatik notification permission iste
        // Backend'de yeni cihaz oluşturulurken HasNotificationPermission default true olacak
        // Bu yüzden burada permission iste, backend otomatik olarak enable olarak kaydedecek
        const isExpoGo = Constants.appOwnership === 'expo';
        if (isExpoGo) {
          // Expo Go'da token alma kısıtlı; yine de izin durumunu backend'e yazalım
          // Backend yeni cihaz için default true yapacak
          checkNotificationPermissions()
            .then(result => collectAndSendDeviceInfo(result.token || undefined, result.hasPermission))
            .catch(err => {
              console.error('[LoginScreen] Failed to check notification permissions:', err);
              // Backend yeni cihaz için default true yapacak, burada null gönderebiliriz
              return collectAndSendDeviceInfo(undefined, undefined);
            })
            .catch(err => {
              console.error('[LoginScreen] Failed to send device info:', err);
            });
        } else {
          // Production/dev build'da yeni kullanıcı için otomatik izin iste
          requestNotificationPermissions()
            .then(result => {
              console.log('[LoginScreen] Notification permission result:', { granted: result.granted, hasToken: !!result.token, hasPermission: result.hasPermission });
              // Gerçek permission durumunu gönder, backend yeni cihaz için default true yapacak
              return collectAndSendDeviceInfo(result.token || undefined, result.hasPermission);
            })
            .catch(err => {
              console.error('[LoginScreen] Failed to request notification permissions:', err);
              // Hata durumunda da mevcut izin durumunu kontrol et
              return checkNotificationPermissions()
                .then(checkResult => {
                  console.log('[LoginScreen] Fallback check result:', { hasToken: !!checkResult.token, hasPermission: checkResult.hasPermission });
                  return collectAndSendDeviceInfo(checkResult.token || undefined, checkResult.hasPermission);
                })
                .catch(() => {
                  // Backend yeni cihaz için default true yapacak
                  return collectAndSendDeviceInfo(undefined, undefined);
                });
            });
        }
        
        setStage('loggedIn');
      } else {
        throw new Error(t('auth.verificationFailed') || 'Doğrulama başarısız');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (stage === 'loggedIn') {
    return <AppNavigator />;
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'android' && { paddingBottom: 100 }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRightBelow}>
          <ThemeToggle />
        </View>
        
        {/* Dil Seçici */}
        <View style={styles.languageSelector}>
          <Pressable
            onPress={() => setLanguageModalVisible(true)}
            style={[styles.languageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="language" size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.languageButtonText, { color: colors.text }]}>
              {languageName(currentLang)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>        
          <View style={styles.logoWrap}>
            <Logo size={120} />
            <Text style={[styles.slogan, { color: colors.textMuted }]}>{t('auth.slogan')}</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{t('auth.loginOrRegister')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('auth.loginOrRegisterSubtitle')}</Text>

          <Input 
            placeholder="email@example.com" 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            autoCapitalize="none"
            editable={!isLoading}
          />

          {stage === 'email' && (
            <Button 
              title={t('auth.continue')} 
              onPress={onContinue} 
              loading={isLoading}
              disabled={isLoading}
              style={{ marginTop: 12 }} 
            />
          )}

          {stage === 'verify' && (
            <>
              <Input 
                ref={codeInputRef}
                placeholder={t('auth.verificationCode')} 
                value={code} 
                onChangeText={setCode} 
                style={{ marginTop: 12 }}
                editable={!isLoading}
                keyboardType="number-pad"
              />
              <Text style={[styles.infoText, { color: colors.textMuted }]}>{t('auth.verificationCodeHint')}</Text>
              <View style={styles.rememberRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Switch 
                    value={remember} 
                    onValueChange={setRemember} 
                    thumbColor={colors.primary} 
                    trackColor={{ true: colors.accent, false: colors.inputBorder }}
                    disabled={isLoading}
                  />
                <Text style={{ color: colors.text, marginLeft: 8 }}>{t('auth.rememberMe')}</Text>
                </View>
                <Pressable 
                  onPress={onResendCode}
                  disabled={isLoading}
                  style={{ opacity: isLoading ? 0.5 : 1 }}
                >
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
                    {t('auth.resend') || 'Resend'}
                  </Text>
                </Pressable>
              </View>
              <Button 
                title={t('auth.verifyAndLogin')} 
                onPress={onVerifyAndLogin} 
                loading={isLoading}
                disabled={isLoading}
                style={{ marginTop: 12 }} 
              />
            </>
          )}

        </View>
      </ScrollView>

      {/* Dil Seçim Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLanguageModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('auth.selectLanguage')}</Text>
            <View style={styles.languageOptions}>
              {(['en', 'tr'] as const).map((lang) => (
                <Pressable
                  key={lang}
                  onPress={() => handleLanguageChange(lang)}
                  style={[
                    styles.languageOption,
                    {
                      backgroundColor: currentLang === lang ? colors.primary + '20' : colors.background,
                      borderColor: currentLang === lang ? colors.primary : colors.border,
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      { color: currentLang === lang ? colors.primary : colors.text }
                    ]}
                  >
                    {languageName(lang)}
                  </Text>
                  {currentLang === lang && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setLanguageModalVisible(false)}
              style={[styles.modalCloseButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.modalCloseButtonText}>{t('common.close')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { 
    flexGrow: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16,
    minHeight: '100%',
  },
  headerRightBelow: { position: 'absolute', top: 56, right: 18, zIndex: 10 },
  languageSelector: {
    position: 'absolute',
    top: 56,
    left: 18,
    zIndex: 10,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  card: { width: '92%', borderRadius: 16, padding: 20, borderWidth: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, marginBottom: 16, textAlign: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 12, marginBottom: 6 },
  slogan: { fontSize: 14, fontWeight: '500', letterSpacing: 0.3, marginTop: 12, textAlign: 'center' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  infoText: { fontSize: 12, marginTop: 6, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  languageOptions: {
    gap: 12,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  languageOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});


