import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, SupportedLocale } from './translations';

const resources = Object.entries(translations).reduce((acc, [lng, value]) => {
  acc[lng] = { 
    translation: value
  };
  return acc;
}, {} as Record<string, { translation: any }>);

export async function configureI18n() {
  try {
    // Allowed languages: en, tr
    const allowed: SupportedLocale[] = ['en', 'tr'] as any;
    const fallbackLng: SupportedLocale = 'en';

    // Telefon dilini otomatik algıla (Türkçe ise tr, değilse en)
    let deviceLang: SupportedLocale = 'en';
    try {
      const deviceLocale = Localization.locale?.toLowerCase() || 'en';
      deviceLang = deviceLocale.startsWith('tr') ? 'tr' : 'en';
    } catch {
      deviceLang = 'en';
    }

    // AsyncStorage'dan tercih edilen arayüz dilini oku
    let initialLang: SupportedLocale = fallbackLng;
    try {
      const stored = await AsyncStorage.getItem('ui_lang');
      if (stored && (allowed as string[]).includes(stored)) {
        initialLang = stored as SupportedLocale;
      } else {
        // Eğer kayıtlı dil yoksa telefon dilini kullan
        initialLang = deviceLang;
        // Telefon dilini AsyncStorage'a kaydet
        try {
          await AsyncStorage.setItem('ui_lang', deviceLang);
        } catch {
          // AsyncStorage hatası önemli değil
        }
      }
    } catch {
      // Hata durumunda telefon dilini kullan
      initialLang = deviceLang;
    }

    if (!i18n.isInitialized) {
      await i18n
        .use(initReactI18next)
        .init({
          resources,
          lng: translations[initialLang] ? initialLang : fallbackLng,
          fallbackLng,
          interpolation: { escapeValue: false },
        });
    } else {
      // Eğer daha önce init olduysa ve dil değişikliği gerekiyorsa uygula
      if (i18n.language !== initialLang) {
        await i18n.changeLanguage(initialLang);
      }
    }
  } catch (error) {
    console.error('i18n configuration error:', error);
    // Hata durumunda en azından İngilizce ile başlat
    if (!i18n.isInitialized) {
      try {
        await i18n
          .use(initReactI18next)
          .init({
            resources,
            lng: 'en',
            fallbackLng: 'en',
            interpolation: { escapeValue: false },
          });
      } catch (initError) {
        console.error('i18n fallback initialization error:', initError);
      }
    }
  }
}

export default i18n;

