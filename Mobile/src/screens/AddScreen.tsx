import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Dimensions, StatusBar, Animated, ActivityIndicator, Alert, Switch, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import { Button } from '../components/ui/Button';
import { Category } from '../api/categories';
import { CategoryPicker } from '../components/CategoryPicker';
import { PhotoAnalyzer } from '../components/PhotoAnalyzer';
import { createProduct } from '../api/products';
import { API_BASE_URL } from '../api/auth';
import i18n from '../i18n';
import { TagInput } from '../components/ui/TagInput';
import { PhotoAnalysisResult, photoAnalysisAPI } from '../api/photoAnalysis';
import { suggestCategoryByAI } from '../api/categories';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useToast } from '../components/ui/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserPreferences } from '../api/userPreferences';
import { getOperationCosts, AIOperationCost } from '../api/aiCredits';
import { usePremium } from '../hooks/usePremium';

const { width: screenWidth } = Dimensions.get('window');

export const AddScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const toast = useToast();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedPath, setSelectedPath] = useState<Category[] | null>(null);
  const [title, setTitle] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [hashtagsText, setHashtagsText] = useState('');
  const [combined, setCombined] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [price, setPrice] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [commentsEnabled, setCommentsEnabled] = useState<boolean>(true);
  const [selectedUris, setSelectedUris] = useState<{ uri: string; name?: string; type?: string }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [scrollY] = useState(new Animated.Value(0));
  const [clearTrigger, setClearTrigger] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('TRY');
  const [isEstimatingPrice, setIsEstimatingPrice] = useState<boolean>(false);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState<boolean>(false);
  const [hasAiDescription, setHasAiDescription] = useState<boolean>(false);
  const [aiOperationCosts, setAiOperationCosts] = useState<AIOperationCost[]>([]);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  
  // Badge states
  const [showBadges, setShowBadges] = useState<boolean>(false);
  const [isRare, setIsRare] = useState<boolean>(false);
  const [isMint, setIsMint] = useState<boolean>(false);
  const [isGraded, setIsGraded] = useState<boolean>(false);
  const [isSigned, setIsSigned] = useState<boolean>(false);
  const [isLimited, setIsLimited] = useState<boolean>(false);
  const [isFeatured, setIsFeatured] = useState<boolean>(false);

  // Premium kontrolü
  const { isPremium, checkFeatureAccess } = usePremium();
  
  const navigateToPlans = () => {
    navigation.navigate('Plans');
  };

  // Load AI operation costs
  useEffect(() => {
    const loadCosts = async () => {
      try {
        const costs = await getOperationCosts();
        setAiOperationCosts(costs);
      } catch (error) {
        console.error('Failed to load AI operation costs:', error);
      }
    };
    loadCosts();
  }, []);

  // Load user currency preference
  useEffect(() => {
    (async () => {
      try {
        const token = (await AsyncStorage.getItem('auth_token')) || '';
        if (token) {
          const prefs = await fetchUserPreferences(token);
          if (prefs?.currency) {
            setCurrency(prefs.currency);
          }
        }
      } catch {}
    })();
  }, []);

  // Sayfa açıldığında scroll pozisyonunu en üste ayarla (Android için)
  useFocusEffect(
    useCallback(() => {
      // Klavye açıksa kapat
      Keyboard.dismiss();
      
      // Kısa bir delay ile scroll pozisyonunu ayarla (layout tamamlandıktan sonra)
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, Platform.OS === 'android' ? 200 : 100);

      return () => clearTimeout(timer);
    }, [])
  );

  const handleAnalysisComplete = useCallback((result: PhotoAnalysisResult) => {
    console.log('handleAnalysisComplete called with:', result);
    
    setTitle(result.title || '');

    // 3-6 kelimelik kısa açıklama önerisi
    const tr = (result.description_tr || '').trim();
    let short = '';
    if (tr.length > 0) {
      const words = tr.replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
      short = words.slice(0, Math.min(6, Math.max(3, words.length))).join(' ');
    } else if (result.entities?.length) {
      short = result.entities.slice(0, 3).map(e => e.name).join(' ');
    }
    setShortDesc(short);

    // Tüm hashtag'leri kullan (12'ye kadar)
    const tags = (result.hashtags || []).join(' ');
    setHashtagsText(tags);

    // Çoklu satır birleşik alan
    const combinedValue = [result.title || '', short || '', tags || ''].filter(Boolean).join('\n');
    console.log('handleAnalysisComplete setting combined:', combinedValue);
    setCombined(combinedValue);
    
    // AI açıklaması varsa hasAiDescription'ı true yap
    setHasAiDescription(!!(result.title || short || tags));
  }, []);

  // Gelişmiş analiz sonuçlarından hashtag üret
  const GenerateHashtagsFromEnhanced = (enhanced: any) => {
    const hashtags = new Set<string>();

    // Backend'den gelen hashtag'leri kullan (öncelikli!)
    // Önce hashtags, sonra geminiHashtags kontrol et
    const backendHashtags = enhanced?.hashtags || enhanced?.geminiHashtags;
    if (backendHashtags && Array.isArray(backendHashtags) && backendHashtags.length > 0) {
      console.log('Backend hashtags:', backendHashtags);
      // Boş string'leri filtrele
      return backendHashtags.filter((tag: string) => tag && tag.trim().length > 0);
    }

    // Fallback: Frontend'de üret
    console.log('Backend hashtag yok, frontend üretiyor...');
    
    if (enhanced?.finalIdentification) {
      const { brand, model, productName } = enhanced.finalIdentification;

      const words = [brand, model, productName]
        .filter(Boolean)
        .join(' ')
        .split(/\s+/)
        .filter(Boolean);

      words.forEach(word => {
        const clean = word.replace(/[^\w]/g, '').toLowerCase();
        if (clean.length > 2 && clean.length < 20) {
          hashtags.add(`#${clean}`);
        }
      });
    }

    const visionLabels = enhanced?.dataCollection?.visionResults?.[0]?.labels || [];
    visionLabels.slice(0, 3).forEach((label: any) => {
      const clean = (label?.description || '').replace(/[^\w]/g, '').toLowerCase();
      if (clean.length > 2 && clean.length < 20) {
        hashtags.add(`#${clean}`);
      }
    });

    const webEntities = enhanced?.dataCollection?.visionResults?.[0]?.webEntities || [];
    webEntities.slice(0, 3).forEach((entity: any) => {
      const clean = (entity?.description || '').replace(/[^\w]/g, '').toLowerCase();
      if (clean.length > 2 && clean.length < 20) {
        hashtags.add(`#${clean}`);
      }
    });

    return Array.from(hashtags).slice(0, 12);
  };

  // Formu temizleme fonksiyonu
  const clearForm = () => {
    setTitle('');
    setShortDesc('');
    setHashtagsText('');
    setCombined('');
    setHasAiDescription(false);
    setPrice('');
    setSelectedPath(null);
    setSelectedUris([]);
    setShowAdvanced(false);
    setIsPublic(true);
    setCommentsEnabled(true);
    setIsSuggestingCategory(false);
    setClearTrigger(prev => prev + 1); // PhotoAnalyzer'ı temizle
  };

  const handleSuggestCategory = async () => {
    if (isAnalyzing || isSuggestingCategory) return;

    if (selectedUris.length === 0) {
      toast.show({
        type: 'error',
        message: t('common.error'),
        subMessage: t('addProduct.atLeastOnePhoto'),
      });
      return;
    }

    const productText = (combined || '').trim() || [title, shortDesc, hashtagsText].filter(Boolean).join('\n');
    const descriptionLength = productText.trim().length;
    
    if (descriptionLength < 10) {
      toast.show({
        type: 'error',
        message: t('common.error'),
        subMessage: t('addProduct.minDescriptionLength') || 'Lütfen en az 10 karakterlik ürün açıklaması girin',
      });
      return;
    }

    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      toast.show({ type: 'error', message: t('addProduct.authRequired') || 'Authentication required' });
      return;
    }

    setIsSuggestingCategory(true);
    try {
      const res = await suggestCategoryByAI(token, productText);
      if (!res.success || !res.categoryPath || res.categoryPath.length === 0) {
        toast.show({
          type: 'info',
          message: t('common.error'),
          subMessage: res.error || (res.reasoning as any) || 'Kategori önerilemedi',
        });
        return;
      }

      // CategoryPicker'ın beklediği tipe map et
      const path: Category[] = res.categoryPath.map((n) => ({
        id: n.id,
        name: n.name,
      }));
      setSelectedPath(path);

      toast.show({
        type: 'success',
        message: t('common.success'),
        subMessage: `Kategori: ${path.map(p => p.name).join(' / ')}`,
      });
    } catch (e: any) {
      // Hata mesajını daha kullanıcı dostu hale getir
      let errorMessage = e?.message || 'Kategori önerisi hatası';
      
      // "API hatası (XXX):" prefix'ini kaldır
      if (errorMessage.startsWith('API hatası')) {
        errorMessage = errorMessage.replace(/^API hatası \(\d+\): /, '');
      }
      
      // AI kredisi yetersiz hatası için özel işlem
      const isInsufficientCredits = errorMessage.includes('Yetersiz AI kredisi') || 
                                    errorMessage.includes('Insufficient AI credits') ||
                                    (errorMessage.includes('yetersiz') && errorMessage.includes('kredi'));
      
      if (isInsufficientCredits) {
        // Kredi bitti hatası - özel mesaj ve yönlendirme
        Alert.alert(
          t('common.error') || 'Hata',
          errorMessage + '\n\n' + (t('aiCredits.insufficientCreditsMessage') || 'AI kredisi satın almak için Plans sayfasına gidebilirsiniz.'),
          [
            {
              text: t('common.cancel') || 'İptal',
              style: 'cancel'
            },
            {
              text: t('aiCredits.goToPlans') || 'Plans\'a Git',
              onPress: () => navigation.navigate('Plans' as never)
            }
          ]
        );
      } else {
        toast.show({
          type: 'error',
          message: t('common.error'),
          subMessage: errorMessage,
        });
      }
    } finally {
      setIsSuggestingCategory(false);
    }
  };

  const handleSave = async () => {
    // Zaten kaydediliyorsa veya analiz devam ediyorsa kaydetmeyi engelle
    if (isSaving || isAnalyzing) {
    if (isAnalyzing) {
      toast.show({ type: 'info', message: 'Lütfen bekleyin', subMessage: 'AI analiz tamamlanana kadar' });
      }
      return;
    }

    try {
      setIsSaving(true);
      console.log('[AddScreen] === ÜRÜN KAYIT BAŞLANGICI ===');
      console.log('[AddScreen] combined (ham veri):', JSON.stringify(combined));
      console.log('[AddScreen] combined length:', combined.length);
      console.log('[AddScreen] combined newlines:', (combined.match(/\n/g) || []).length);
      
      const lines = combined.split(/\n/);
      console.log('[AddScreen] lines array:', lines);
      console.log('[AddScreen] lines count:', lines.length);
      
      const finalTitle = lines[0] || title || 'Untitled';
      console.log('[AddScreen] finalTitle:', JSON.stringify(finalTitle));
      
      // Description: 2. satırdan (index 1) hashtag'lerin başladığı yere kadar TÜM SATIRLAR
      // Hashtag'ler genellikle # ile başlar, ama açıklama içinde de # olabilir
      // Hashtag alanı: Sadece # ile başlayan ve sadece hashtag formatında olan satırlar
      let descriptionEndIndex = lines.length;
      for (let i = 1; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();
        // Eğer satır sadece hashtag içeriyorsa (başında # var ve sadece hashtag formatında), hashtag alanı başlamış demektir
        if (trimmedLine && trimmedLine.startsWith('#')) {
          // Sadece hashtag'lerden oluşuyorsa (boşluk, #, harf/rakam karakterleri)
          // Örnek: "#tag" veya "#tag1 #tag2" -> hashtag alanı
          // Örnek: "Bu bir #hashtag içeriyor" -> açıklama devam ediyor
          const isOnlyHashtags = /^[\s#\w]+$/.test(trimmedLine) && trimmedLine.split(/\s+/).every(word => word.startsWith('#'));
          if (isOnlyHashtags) {
            descriptionEndIndex = i;
            break;
          }
        }
      }
      console.log('[AddScreen] descriptionEndIndex:', descriptionEndIndex);
      console.log('[AddScreen] description lines (slice 1 to endIndex):', lines.slice(1, descriptionEndIndex));
      
      // Description'ı birleştir (yeni satırları koru) - 1. satırdan (index 1) hashtag'lerin başladığı yere kadar
      // NOT: slice(1, endIndex) 1. index'ten başlar, endIndex'e kadar alır (endIndex dahil değil)
      const descriptionLines = lines.slice(1, descriptionEndIndex);
      console.log('[AddScreen] descriptionLines before join:', descriptionLines);
      console.log('[AddScreen] descriptionLines count:', descriptionLines.length);
      // Eğer descriptionLines boşsa veya sadece boşluk içeriyorsa, shortDesc kullan
      // Ama descriptionLines varsa, onu kullan (çünkü combined'dan parse edildi, newline'ları korur)
      // ÖNEMLİ: join('\n') ile birleştirirken newline'ları koruyoruz
      const parsedDescription = descriptionLines.join('\n').trim();
      console.log('[AddScreen] parsedDescription after join:', JSON.stringify(parsedDescription));
      console.log('[AddScreen] parsedDescription newlines:', (parsedDescription.match(/\n/g) || []).length);
      const finalDescription = parsedDescription || shortDesc || '';
      console.log('[AddScreen] finalDescription (birleştirilmiş):', JSON.stringify(finalDescription));
      console.log('[AddScreen] finalDescription length:', finalDescription.length);
      console.log('[AddScreen] finalDescription newlines:', (finalDescription.match(/\n/g) || []).length);
      
      // Hashtags: Description'dan sonraki satırlar
      const finalHashtags = hashtagsText || lines.slice(descriptionEndIndex).join(' ').trim() || '';
      console.log('[AddScreen] finalHashtags:', JSON.stringify(finalHashtags));

      const payload = {
        title: finalTitle,
        description: finalDescription,
        hashtags: finalHashtags,
        categoryId: selectedPath && selectedPath.length > 0 ? selectedPath[selectedPath.length - 1].id : undefined,
        price: price.trim() ? Number(price) : undefined,
        isPublic,
        commentsEnabled,
        photos: selectedUris.map(p => ({ uri: p.uri, name: p.name || 'photo.jpg', type: p.type || 'image/jpeg' })),
        // Badge fields
        isRare,
        isMint,
        isGraded,
        isSigned,
        isLimited,
        isFeatured,
      };
      if (payload.photos.length === 0) {
        Alert.alert(t('addProduct.error'), t('addProduct.atLeastOnePhoto'));
        setIsSaving(false);
        return;
      }
      const res = await createProduct(payload as any);
      // Önce toast'ı burada göster
      toast.show({ type: 'success', message: t('addProduct.success'), subMessage: t('addProduct.productSaved') });
      clearForm();
      // Sonra Profile'a yönlendir
      navigation.navigate('Profile');
    } catch (e: any) {
      toast.show({ type: 'error', message: t('addProduct.error'), subMessage: e?.message || t('addProduct.productSaveError') });
    } finally {
      setIsSaving(false);
    }
  };

  // Tema uyumlu gradient renkler
  const getGradientColors = () => {
    if (currentTheme === 'dark') {
      return [colors.surface, colors.background, colors.border];
    } else {
      return [colors.primary + '40', colors.accent + '30', colors.surface];
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ flex: 1 }}>
      <StatusBar 
        barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      
      {/* Modern Gradient Header */}
      <LinearGradient
        colors={getGradientColors()}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
      />
      
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View
          style={{
            opacity: headerOpacity,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          {/* First row: Title and subtitle */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: '700',
              marginBottom: 6,
            }}>
              {t('addProduct.title')}
            </Text>
            <Text style={{
              color: colors.textMuted,
              fontSize: 14,
            }}>
              {t('addProduct.subtitle')}
            </Text>
          </View>
        </Animated.View>

        {/* Content */}
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <Animated.ScrollView
            ref={scrollViewRef}
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              marginTop: -12,
            }}
          >
          <View style={{ paddingTop: 16 }}>
            {/* Fotoğraf Yükleme Kartı - Kompakt */}
            <View style={{
              backgroundColor: colors.surface,
              marginHorizontal: 20,
              marginBottom: 16,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: currentTheme === 'dark' ? '#000' : colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: currentTheme === 'dark' ? 0.2 : 0.06,
              shadowRadius: 8,
              elevation: 4,
            }}>
              {/* Header - Kompakt Tasarım */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
                width: '100%',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                    flexShrink: 0,
                  }}>
                    <Ionicons name="camera" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '600',
                    }} numberOfLines={1}>
                      {t('addProduct.photoUpload')}
                    </Text>
                    <Text style={{
                      color: colors.textMuted,
                      fontSize: 13,
                    }} numberOfLines={1}>
                      {t('addProduct.cameraOrGallery')}
                    </Text>
                  </View>
                </View>
              </View>

              <PhotoAnalyzer
                key={`photo-analyzer-${clearTrigger}`}
                maxPhotos={10}
                onSelectionChange={(list) => setSelectedUris(list)}
                compact={false}
                enableAnalysis={false}
                onAnalyzingChange={setIsAnalyzing}
                useEnhancedAnalysis={false}
                clearTrigger={clearTrigger}
              />

              {/* Analiz Loading Göstergesi */}
              {isAnalyzing && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.primary + '15',
                  marginHorizontal: 16,
                  marginTop: 12,
                  marginBottom: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.primary + '30',
                }}>
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{
                    color: colors.primary,
                    fontSize: 14,
                    fontWeight: '600',
                  }}>
                    AI analiz ediliyor...
                  </Text>
                </View>
              )}
            </View>

            {/* Ürün Bilgileri Kartı - Kompakt */}
            <View style={{
              backgroundColor: colors.surface,
              marginHorizontal: 20,
              marginBottom: 16,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: currentTheme === 'dark' ? '#000' : colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: currentTheme === 'dark' ? 0.2 : 0.06,
              shadowRadius: 8,
              elevation: 4,
            }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                marginBottom: 16,
                justifyContent: 'space-between'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="create" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      color: colors.text, 
                      fontSize: 16, 
                      fontWeight: '600',
                    }}>
                      {t('addProduct.productInfo')}
                    </Text>
                  </View>
                </View>
                
                {/* AI Check Butonu */}
                <Pressable
                  onPress={async () => {
                    if (isAnalyzing) return;
                    
                    if (selectedUris.length === 0) {
                      toast.show({ 
                        type: 'error', 
                        message: t('common.error'),
                        subMessage: t('addProduct.atLeastOnePhoto')
                      });
                      return;
                    }
                    
                    setIsAnalyzing(true);
                    try {
                      const token = await AsyncStorage.getItem('auth_token');
                      if (!token) {
                        toast.show({ 
                          type: 'error', 
                          message: t('addProduct.authRequired') || 'Authentication required'
                        });
                        return;
                      }
                      
                      // AI dilini AsyncStorage'dan oku (AI Language ayarı)
                      const aiLanguage = (await AsyncStorage.getItem('ai_lang')) || 'en';
                      const langParam = aiLanguage === 'tr' ? 'tr' : 'en';
                      
                      console.log('=== ADD SCREEN AI ANALİZ BAŞLATILIYOR ===');
                      console.log('API_BASE_URL:', API_BASE_URL);
                      console.log('Full URL:', `${API_BASE_URL}/api/photoanalysis/enhanced`);
                      console.log('Photo Count:', selectedUris.length);
                      console.log('AI Language (from settings):', aiLanguage);
                      console.log('Language param:', langParam);
                      console.log('Token:', token ? `Bearer ${token.substring(0, 20)}...` : 'Yok');

                      // photoAnalysisAPI (axios) kullan
                      const analysisResponse = await photoAnalysisAPI.analyzePhotosEnhanced(
                        selectedUris as any,
                        langParam
                      );

                      console.log('=== ANALİZ SONUCU ALINDI (AddScreen) ===');
                      console.log('Success:', analysisResponse.success);
                      
                      if (analysisResponse.success && analysisResponse.result) {
                        const result = analysisResponse.result;
                        
                        const brand = (result.finalIdentification.brand || '').trim();
                        const model = (result.finalIdentification.model || '').trim();
                        const productName = (result.finalIdentification.productName || '').trim();
                        const titleFromBrandModel = [brand, model].filter(Boolean).join(' ');
                        const computedTitle = productName || titleFromBrandModel || t('editProduct.notIdentified');
                        
                        // Backend'den gelen hashtag'leri kullan
                        const backendHashtags = result?.hashtags || result?.geminiHashtags;
                        let enhancedHashtags: string[] = [];
                        
                        if (backendHashtags && Array.isArray(backendHashtags) && backendHashtags.length > 0) {
                          enhancedHashtags = backendHashtags.filter((tag: string) => tag && tag.trim().length > 0);
                        } else {
                          // Fallback: Frontend'de üret
                          const hashtags = new Set<string>();
                          
                          if (result.finalIdentification) {
                            const words = [brand, model, productName]
                              .filter(Boolean)
                              .join(' ')
                              .split(/\s+/)
                              .filter(Boolean);
                            
                            words.forEach(word => {
                              const clean = word.replace(/[^\w]/g, '').toLowerCase();
                              if (clean.length > 2 && clean.length < 20) {
                                hashtags.add(clean);
                              }
                            });
                          }
                          
                          const visionLabels = result?.dataCollection?.visionResults?.[0]?.labels || [];
                          visionLabels.slice(0, 3).forEach((label: any) => {
                            const clean = (label?.description || '').replace(/[^\w]/g, '').toLowerCase();
                            if (clean.length > 2 && clean.length < 20) {
                              hashtags.add(clean);
                            }
                          });
                          
                          const webEntities = result?.dataCollection?.visionResults?.[0]?.webEntities || [];
                          webEntities.slice(0, 3).forEach((entity: any) => {
                            const clean = (entity?.description || '').replace(/[^\w]/g, '').toLowerCase();
                            if (clean.length > 2 && clean.length < 20) {
                              hashtags.add(clean);
                            }
                          });
                          
                          enhancedHashtags = Array.from(hashtags).slice(0, 12);
                        }
                        
                        // Hashtag'lere # işareti ekle (eğer yoksa)
                        const hashtagsWithHash = enhancedHashtags.map(tag => 
                          tag.startsWith('#') ? tag : `#${tag}`
                        );
                        const hashtagsStr = hashtagsWithHash.join(' ');
                        
                        // Combined alanını güncelle
                        const combinedValue = `${computedTitle}\n\n${hashtagsStr}`;
                        setCombined(combinedValue);
                        setTitle(computedTitle);
                        setShortDesc('');
                        setHashtagsText(hashtagsStr);
                        setHasAiDescription(true);
                        
                        toast.show({ 
                          type: 'success', 
                          message: t('common.success'),
                          subMessage: t('editProduct.analysisComplete')
                        });
                      } else {
                        toast.show({ 
                          type: 'error', 
                          message: t('common.error'),
                          subMessage: analysisResponse.message || t('editProduct.analysisFailed')
                        });
                      }
                    } catch (error: any) {
                      console.error('=== AI ANALİZ HATASI (AddScreen) ===');
                      console.error('Error Type:', error?.constructor?.name);
                      console.error('Error Message:', error?.message);
                      console.error('Error Stack:', error?.stack);
                      console.error('Error Name:', error?.name);
                      console.error('Error Code:', error?.code);
                      console.error('Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                      console.error('API_BASE_URL:', API_BASE_URL);
                      console.error('Full URL:', `${API_BASE_URL}/api/photoanalysis/enhanced`);
                      
                      // Hata mesajını daha kullanıcı dostu hale getir
                      let errorMessage = error?.message || t('editProduct.analysisError');
                      
                      // "API hatası (XXX):" prefix'ini kaldır
                      if (errorMessage.startsWith('API hatası')) {
                        errorMessage = errorMessage.replace(/^API hatası \(\d+\): /, '');
                      }
                      
                      // AI kredisi yetersiz hatası için özel işlem
                      const isInsufficientCredits = errorMessage.includes('Yetersiz AI kredisi') || 
                                                    errorMessage.includes('Insufficient AI credits') ||
                                                    errorMessage.includes('yetersiz') && errorMessage.includes('kredi');
                      
                      if (isInsufficientCredits) {
                        // Kredi bitti hatası - özel mesaj ve yönlendirme
                        Alert.alert(
                          t('common.error') || 'Hata',
                          errorMessage + '\n\n' + (t('aiCredits.insufficientCreditsMessage') || 'AI kredisi satın almak için Plans sayfasına gidebilirsiniz.'),
                          [
                            {
                              text: t('common.cancel') || 'İptal',
                              style: 'cancel'
                            },
                            {
                              text: t('aiCredits.goToPlans') || 'Plans\'a Git',
                              onPress: () => navigation.navigate('Plans' as never)
                            }
                          ]
                        );
                        return; // Toast göstermeden çık
                      }
                      
                      // Network hatası için daha açıklayıcı mesaj
                      if (errorMessage.includes('Network request failed')) {
                        errorMessage = 'Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.';
                      } else if (errorMessage.includes('timeout')) {
                        errorMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
                      }
                      
                      toast.show({ 
                        type: 'error', 
                        message: t('common.error'),
                        subMessage: errorMessage
                      });
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }}
                  disabled={isAnalyzing}
                  style={{
                    alignItems: 'center',
                    backgroundColor: isAnalyzing ? colors.border : colors.primary + '10',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isAnalyzing ? colors.border : colors.primary + '30',
                    opacity: isAnalyzing ? 0.5 : 1,
                  }}
                >
                  {isAnalyzing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="sparkles" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={{
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: '600',
                        }}>
                          {t('addProduct.aiCheck') || 'AI Check'}
                        </Text>
                      </View>
                      {/* AI Credit Cost - Alt Satır */}
                      <Text style={{
                        color: colors.primary,
                        fontSize: 9,
                        fontWeight: '500',
                        marginTop: 2,
                        opacity: 0.8
                      }}>
                        {aiOperationCosts.find(c => c.operationType === 'ProductRecognition')?.creditCost ?? 3} {t('credits') || 'credits'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              <TagInput
                value={combined}
                onChangeText={(t) => {
                  console.log('[AddScreen] onChangeText - combined (ham):', JSON.stringify(t));
                  console.log('[AddScreen] onChangeText - newline count:', (t.match(/\n/g) || []).length);
                  
                  setCombined(t);
                  const lines = t.split(/\n/);
                  console.log('[AddScreen] onChangeText - lines array:', lines);
                  console.log('[AddScreen] onChangeText - lines count:', lines.length);
                  
                  setTitle(lines[0] ?? '');
                  // Description: 2. satırdan hashtag'lerin başladığı yere kadar TÜM SATIRLAR
                  // Hashtag'ler genellikle # ile başlar, ama açıklama içinde de # olabilir
                  // Hashtag alanı: Sadece # ile başlayan ve sadece hashtag formatında olan satırlar
                  let descriptionEndIndex = lines.length;
                  for (let i = 1; i < lines.length; i++) {
                    const trimmedLine = lines[i].trim();
                    // Eğer satır sadece hashtag içeriyorsa (başında # var ve sadece hashtag formatında), hashtag alanı başlamış demektir
                    if (trimmedLine && trimmedLine.startsWith('#')) {
                      // Sadece hashtag'lerden oluşuyorsa (boşluk, #, harf/rakam karakterleri)
                      const isOnlyHashtags = /^[\s#\w]+$/.test(trimmedLine) && trimmedLine.split(/\s+/).every(word => word.startsWith('#'));
                      if (isOnlyHashtags) {
                        descriptionEndIndex = i;
                        break;
                      }
                    }
                  }
                  console.log('[AddScreen] onChangeText - descriptionEndIndex:', descriptionEndIndex);
                  
                  // Description'ı birleştir (yeni satırları koru) - 1. satırdan (index 1) hashtag'lerin başladığı yere kadar
                  const description = lines.slice(1, descriptionEndIndex).join('\n');
                  console.log('[AddScreen] onChangeText - description (parsed):', JSON.stringify(description));
                  console.log('[AddScreen] onChangeText - description newlines:', (description.match(/\n/g) || []).length);
                  
                  setShortDesc(description);
                  // Hashtags: Description'dan sonraki satırlar
                  setHashtagsText(lines.slice(descriptionEndIndex).join(' ').trim());
                  // Kullanıcı manuel değiştirirse AI açıklaması olmayabilir
                  // Ama eğer AI'dan gelen veri varsa, kullanıcı düzenlese bile hasAiDescription true kalabilir
                }}
                placeholder={t('addProduct.titlePlaceholder')}
                multiline
                numberOfLines={6}
                style={{ 
                  minHeight: 140,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  fontSize: 16,
                  lineHeight: 24,
                }}
              />
            </View>

            {/* Kategori Kartı - Diğer bölümlerle uyumlu */}
            <View style={{
              backgroundColor: colors.surface,
              marginHorizontal: 20,
              marginBottom: 16,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: currentTheme === 'dark' ? '#000' : colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: currentTheme === 'dark' ? 0.2 : 0.06,
              shadowRadius: 8,
              elevation: 4,
            }}>
              {/* Header - Kompakt Tasarım */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 16,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons name="folder" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '600',
                    }}>
                      {t('addProduct.category')}
                    </Text>
                    <Text style={{
                      color: colors.textMuted,
                      fontSize: 13,
                    }}>
                      {t('addProduct.categorySubtitle')}
                    </Text>
                  </View>
                </View>
                {/* AI Category Check Butonu */}
                {(() => {
                  const productText = (combined || '').trim() || [title, shortDesc, hashtagsText].filter(Boolean).join('\n');
                  const hasMinDescription = productText.trim().length >= 10;
                  const isButtonEnabled = !isAnalyzing && !isSuggestingCategory && selectedUris.length > 0 && hasMinDescription;
                  
                  return (
                    <Pressable
                      onPress={handleSuggestCategory}
                      disabled={!isButtonEnabled}
                      style={{
                        alignItems: 'center',
                        backgroundColor: isButtonEnabled ? colors.primary + '10' : colors.border,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isButtonEnabled ? colors.primary + '30' : colors.border,
                        opacity: isButtonEnabled ? 1 : 0.5,
                      }}
                    >
                  {isSuggestingCategory ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="sparkles" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={{
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: '600',
                        }}>
                          {t('addProduct.aiCheck') || 'AI Check'}
                        </Text>
                      </View>
                      <Text style={{
                        color: colors.primary,
                        fontSize: 9,
                        fontWeight: '500',
                        marginTop: 2,
                        opacity: 0.8
                      }}>
                        {aiOperationCosts.find(c => c.operationType === 'CategoryDetection')?.creditCost ?? 1} {t('credits') || 'credit'}
                      </Text>
                    </>
                  )}
                    </Pressable>
                  );
                })()}
              </View>

              {/* Category Selector */}
              <Pressable
                onPress={() => !isAnalyzing && setPickerVisible(true)}
                disabled={isAnalyzing}
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  opacity: isAnalyzing ? 0.6 : 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ 
                    color: selectedPath ? colors.text : colors.textMuted, 
                    fontSize: 15,
                    fontWeight: selectedPath ? '600' : '400',
                    flex: 1,
                  }} numberOfLines={1}>
                    {selectedPath ? selectedPath.map(p => p.name).join(' / ') : t('addProduct.selectCategory')}
                  </Text>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={colors.textMuted} 
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </Pressable>
            </View>

            {/* Ürün Detayları Kartı - Kompakt */}
            <View style={{
              backgroundColor: colors.surface,
              marginHorizontal: 20,
              marginBottom: 16,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: currentTheme === 'dark' ? '#000' : colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: currentTheme === 'dark' ? 0.2 : 0.06,
              shadowRadius: 8,
              elevation: 4,
              position: 'relative',
            }}>
              <Pressable 
                onPress={() => setShowAdvanced(v => !v)} 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 12 }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                    flexShrink: 0,
                  }}>
                    <Ionicons name="settings" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ 
                      color: colors.text, 
                      fontSize: 16, 
                      fontWeight: '600',
                      marginBottom: 2,
                    }} numberOfLines={1}>
                      {t('addProduct.advancedSettings')}
                    </Text>
                    <Text style={{ 
                      color: colors.textMuted, 
                      fontSize: 13,
                    }} numberOfLines={2} ellipsizeMode="tail">
                      {t('addProduct.advancedSubtitle')}
                    </Text>
                  </View>
                </View>
                <View style={{
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  height: 30,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Text style={{ 
                    color: colors.primary, 
                    fontSize: 12,
                    fontWeight: '600'
                  }}>
                    {showAdvanced ? t('addProduct.toggleHide') : t('addProduct.toggleShow')}
                  </Text>
                </View>
              </Pressable>

              {showAdvanced && (
                <View style={{ paddingTop: 16 }}>
                  <View style={{ 
                    height: 1, 
                    backgroundColor: colors.border, 
                    marginBottom: 20 
                  }} />
                  
                  {/* Fiyat */}
                  <View style={{ marginBottom: 20 }}>
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      marginBottom: 8 
                    }}>
                      <Text style={{ 
                        color: colors.text, 
                        fontSize: 16,
                        fontWeight: '600',
                      }}>
                        {t('addProduct.price')}
                      </Text>
                      
                      {/* AI Price Check Butonu */}
                      <Pressable
                        onPress={async () => {
                          if (!hasAiDescription || isEstimatingPrice) return;
                          
                          setIsEstimatingPrice(true);
                          try {
                            const token = await AsyncStorage.getItem('auth_token');
                            if (!token) {
                              toast.show({ type: 'error', message: t('addProduct.authRequired') || 'Authentication required' });
                              return;
                            }
                            
                            // Combined'dan açıklamayı al (title + description)
                            const lines = combined.split('\n');
                            const description = lines.slice(0, 2).filter(Boolean).join(' ').trim();
                            
                            if (!description) {
                              toast.show({ type: 'error', message: t('addProduct.noDescription') || 'Product description not found' });
                              return;
                            }
                            
                            // AI dilini AsyncStorage'dan oku (AI Language ayarı)
                            const aiLanguage = (await AsyncStorage.getItem('ai_lang')) || 'en';
                            const langParam = aiLanguage === 'tr' ? 'tr' : 'en';
                            
                            // Android için timeout ile fetch
                            const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number = 60000): Promise<Response> => {
                              return new Promise((resolve, reject) => {
                                const timer = setTimeout(() => {
                                  reject(new Error('Request timeout - İstek zaman aşımına uğradı'));
                                }, timeout);

                                fetch(url, options)
                                  .then(response => {
                                    clearTimeout(timer);
                                    resolve(response);
                                  })
                                  .catch(error => {
                                    clearTimeout(timer);
                                    reject(error);
                                  });
                              });
                            };
                            
                            const response = await fetchWithTimeout(`${API_BASE_URL}/api/products/estimate-price`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                description: description,
                                language: langParam,
                                currency: currency, // Kullanıcının currency'sini gönder
                              }),
                            }, 60000); // 60 saniye timeout
                            
                            if (!response.ok) {
                              const errorText = await response.text();
                              throw new Error(`Price estimation failed: ${response.status} - ${errorText}`);
                            }
                            
                            const data = await response.json();
                            
                            if (data.success && data.estimatedPrice) {
                              setPrice(data.estimatedPrice.toString());
                              toast.show({ 
                                type: 'success', 
                                message: t('addProduct.priceEstimated') || 'Price estimated',
                                subMessage: `${data.estimatedPrice} ${data.currency || currency}`
                              });
                            } else {
                              toast.show({ 
                                type: 'info', 
                                message: t('addProduct.priceNotEstimated') || 'Price could not be estimated',
                                subMessage: data.error || data.reasoning || ''
                              });
                            }
                          } catch (error: any) {
                            console.error('Price estimation error:', error);
                            
                            // Hata mesajını daha kullanıcı dostu hale getir
                            let errorMessage = error?.message || '';
                            
                            // "API hatası (XXX):" veya "Price estimation failed: XXX" prefix'ini kaldır
                            if (errorMessage.startsWith('API hatası')) {
                              errorMessage = errorMessage.replace(/^API hatası \(\d+\): /, '');
                            } else if (errorMessage.startsWith('Price estimation failed:')) {
                              // JSON parse etmeyi dene
                              try {
                                const jsonMatch = errorMessage.match(/\{.*\}/);
                                if (jsonMatch) {
                                  const errorData = JSON.parse(jsonMatch[0]);
                                  errorMessage = errorData.error || errorData.message || errorMessage;
                                } else {
                                  errorMessage = errorMessage.replace(/^Price estimation failed: \d+ - /, '');
                                }
                              } catch {
                                errorMessage = errorMessage.replace(/^Price estimation failed: \d+ - /, '');
                              }
                            }
                            
                            // AI kredisi yetersiz hatası için özel işlem
                            const isInsufficientCredits = errorMessage.includes('Yetersiz AI kredisi') || 
                                                          errorMessage.includes('Insufficient AI credits') ||
                                                          (errorMessage.includes('yetersiz') && errorMessage.includes('kredi'));
                            
                            if (isInsufficientCredits) {
                              // Kredi bitti hatası - özel mesaj ve yönlendirme
                              Alert.alert(
                                t('common.error') || 'Hata',
                                errorMessage + '\n\n' + (t('aiCredits.insufficientCreditsMessage') || 'AI kredisi satın almak için Plans sayfasına gidebilirsiniz.'),
                                [
                                  {
                                    text: t('common.cancel') || 'İptal',
                                    style: 'cancel'
                                  },
                                  {
                                    text: t('aiCredits.goToPlans') || 'Plans\'a Git',
                                    onPress: () => navigation.navigate('Plans' as never)
                                  }
                                ]
                              );
                              return; // Toast göstermeden çık
                            }
                            
                            // Network hatası için daha açıklayıcı mesaj
                            if (errorMessage.includes('Network request failed')) {
                              errorMessage = 'Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.';
                            } else if (errorMessage.includes('timeout')) {
                              errorMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
                            }
                            
                            toast.show({ 
                              type: 'error', 
                              message: t('addProduct.priceEstimationError') || 'Price estimation failed',
                              subMessage: errorMessage
                            });
                          } finally {
                            setIsEstimatingPrice(false);
                          }
                        }}
                        disabled={!hasAiDescription || isEstimatingPrice}
                        style={{
                          alignItems: 'center',
                          backgroundColor: hasAiDescription && !isEstimatingPrice ? colors.primary + '10' : colors.border,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: hasAiDescription && !isEstimatingPrice ? colors.primary + '30' : colors.border,
                          opacity: hasAiDescription && !isEstimatingPrice ? 1 : 0.5,
                        }}
                      >
                        {isEstimatingPrice ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons
                            name="sparkles"
                            size={14}
                            color={hasAiDescription && !isEstimatingPrice ? colors.primary : colors.textMuted}
                            style={{ marginRight: 4 }}
                          />
                        <Text style={{
                          color: hasAiDescription && !isEstimatingPrice ? colors.primary : colors.textMuted,
                          fontSize: 12,
                          fontWeight: '600',
                        }}>
                                {t('addProduct.aiCheck') || 'AI Check'}
                        </Text>
                            </View>
                            {/* AI Credit Cost - Alt Satır */}
                            <Text style={{
                              color: hasAiDescription ? colors.primary : colors.textMuted,
                              fontSize: 9,
                              fontWeight: '500',
                              marginTop: 2,
                              opacity: 0.8
                            }}>
                              {aiOperationCosts.find(c => c.operationType === 'PriceDetection')?.creditCost ?? 1} {t('credits') || 'credit'}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        placeholder={t('addProduct.pricePlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="decimal-pad"
                        style={{
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 16,
                          paddingHorizontal: 16,
                          paddingRight: 60, // Currency için alan bırak
                          paddingVertical: 16,
                          color: colors.text,
                          fontSize: 16,
                        }}
                      />
                      <View style={{
                        position: 'absolute',
                        right: 16,
                        top: 0,
                        bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                        pointerEvents: 'none',
                      }}>
                        <Text style={{ 
                          color: colors.textMuted, 
                          fontSize: 16,
                          fontWeight: '600',
                        }}>
                          {currency}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ 
                      color: colors.textMuted, 
                      fontSize: 12,
                      marginTop: 6,
                      fontStyle: 'italic',
                    }}>
                      {t('addProduct.pricePrivacy')}
                    </Text>
                  </View>

                  {/* Paylaşım Ayarı */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    backgroundColor: colors.background,
                    padding: 16,
                    borderRadius: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons 
                        name={isPublic ? "globe" : "lock-closed"} 
                        size={20} 
                        color={colors.primary} 
                        style={{ marginRight: 12 }}
                      />
                      <View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                          {t('addProduct.sharing')}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                          {isPublic ? t('addProduct.public') : t('addProduct.private')}
                        </Text>
                      </View>
                    </View>
                    <Switch 
                      value={isPublic} 
                      onValueChange={(value) => {
                        // Private yapmak istiyorsa premium kontrolü yap
                        if (!value && !isPremium) {
                          checkFeatureAccess('PrivateProducts', navigateToPlans);
                          return;
                        }
                        setIsPublic(value);
                      }} 
                      thumbColor={colors.primary} 
                      trackColor={{ true: colors.accent + '60', false: colors.border }} 
                    />
                  </View>

                  {/* Yorum Ayarı */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    backgroundColor: colors.background,
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons 
                        name={commentsEnabled ? "chatbubbles" : "chatbubbles-outline"} 
                        size={20} 
                        color={colors.primary} 
                        style={{ marginRight: 12 }}
                      />
                      <View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                          {t('addProduct.comments')}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                          {commentsEnabled ? t('addProduct.commentsOn') : t('addProduct.commentsOff')}
                        </Text>
                      </View>
                    </View>
                    <Switch 
                      value={commentsEnabled} 
                      onValueChange={setCommentsEnabled} 
                      thumbColor={colors.primary} 
                      trackColor={{ true: colors.accent + '60', false: colors.border }} 
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Badge Yönetimi - Advanced Settings gibi */}
            <View style={{
              backgroundColor: colors.surface,
              marginHorizontal: 20,
              marginBottom: 16,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: currentTheme === 'dark' ? '#000' : colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: currentTheme === 'dark' ? 0.2 : 0.06,
              shadowRadius: 8,
              elevation: 4,
              position: 'relative',
            }}>
              <Pressable 
                onPress={() => setShowBadges(v => !v)} 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 12 }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                    flexShrink: 0,
                  }}>
                    <Ionicons name="ribbon" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ 
                      color: colors.text, 
                      fontSize: 16, 
                      fontWeight: '600',
                      marginBottom: 2,
                    }} numberOfLines={1}>
                      {t('addProduct.badges')}
                    </Text>
                    <Text style={{ 
                      color: colors.textMuted, 
                      fontSize: 13,
                    }} numberOfLines={2} ellipsizeMode="tail">
                      {t('addProduct.badgesSubtitle')}
                    </Text>
                  </View>
                </View>
                <View style={{
                  backgroundColor: colors.background,
                  paddingHorizontal: 12,
                  height: 30,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Text style={{ 
                    color: colors.primary, 
                    fontSize: 12,
                    fontWeight: '600'
                  }}>
                    {showBadges ? t('addProduct.toggleHide') : t('addProduct.toggleShow')}
                  </Text>
                </View>
              </Pressable>

              {showBadges && (
                <View style={{ paddingTop: 16 }}>
                  <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

                  {/* Premium uyarısı */}
                  {!isPremium && (
                    <Pressable
                      onPress={() => checkFeatureAccess('ProductBadges', navigateToPlans)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#FFD70015',
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: '#FFD700',
                      }}
                    >
                      <Ionicons name="lock-closed" size={20} color="#FFD700" style={{ marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                          {t('premium.badgesLocked') || 'Badge\'ler Premium özelliğidir'}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          {t('premium.upgradeToUnlock') || 'Kullanmak için Premium\'a yükseltin'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </Pressable>
                  )}

                  <View style={{ gap: 12, opacity: isPremium ? 1 : 0.5 }} pointerEvents={isPremium ? 'auto' : 'none'}>
                    {/* Rare */}
                    <Pressable 
                      onPress={() => isPremium && setIsRare(!isRare)}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        backgroundColor: isRare ? colors.primary + '10' : colors.background,
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isRare ? colors.primary : colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, marginRight: 10 }}>💎</Text>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{t('badges.rare')}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('badges.rareDesc')}</Text>
                        </View>
                      </View>
                      <Switch value={isRare} onValueChange={(v) => isPremium && setIsRare(v)} thumbColor={colors.primary} disabled={!isPremium} />
                    </Pressable>

                    {/* Mint */}
                    <Pressable 
                      onPress={() => isPremium && setIsMint(!isMint)}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        backgroundColor: isMint ? colors.primary + '10' : colors.background,
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isMint ? colors.primary : colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, marginRight: 10 }}>⭐</Text>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{t('badges.mint')}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('badges.mintDesc')}</Text>
                        </View>
                      </View>
                      <Switch value={isMint} onValueChange={(v) => isPremium && setIsMint(v)} thumbColor={colors.primary} disabled={!isPremium} />
                    </Pressable>

                    {/* Graded */}
                    <Pressable 
                      onPress={() => isPremium && setIsGraded(!isGraded)}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        backgroundColor: isGraded ? colors.primary + '10' : colors.background,
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isGraded ? colors.primary : colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, marginRight: 10 }}>🎖️</Text>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{t('badges.graded')}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('badges.gradedDesc')}</Text>
                        </View>
                      </View>
                      <Switch value={isGraded} onValueChange={(v) => isPremium && setIsGraded(v)} thumbColor={colors.primary} disabled={!isPremium} />
                    </Pressable>

                    {/* Signed */}
                    <Pressable 
                      onPress={() => isPremium && setIsSigned(!isSigned)}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        backgroundColor: isSigned ? colors.primary + '10' : colors.background,
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isSigned ? colors.primary : colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, marginRight: 10 }}>✍️</Text>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{t('badges.signed')}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('badges.signedDesc')}</Text>
                        </View>
                      </View>
                      <Switch value={isSigned} onValueChange={(v) => isPremium && setIsSigned(v)} thumbColor={colors.primary} disabled={!isPremium} />
                    </Pressable>

                    {/* Limited */}
                    <Pressable 
                      onPress={() => isPremium && setIsLimited(!isLimited)}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        backgroundColor: isLimited ? colors.primary + '10' : colors.background,
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isLimited ? colors.primary : colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, marginRight: 10 }}>🔖</Text>
                        <View>
                          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{t('badges.limited')}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('badges.limitedDesc')}</Text>
                        </View>
                      </View>
                      <Switch value={isLimited} onValueChange={(v) => isPremium && setIsLimited(v)} thumbColor={colors.primary} disabled={!isPremium} />
                    </Pressable>
                  </View>

                  <View style={{ 
                    marginTop: 16,
                    padding: 12,
                    backgroundColor: colors.background,
                    borderRadius: 12,
                  }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                      {t('badges.info')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Temizle & Kaydet Butonları */}
            <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t('addProduct.clear')}
                    variant="outline"
                    onPress={clearForm}
                    disabled={isAnalyzing}
                    style={{
                      paddingVertical: 16,
                      borderRadius: 18,
                      opacity: isAnalyzing ? 0.6 : 1,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: colors.primary,
                    borderRadius: 20,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                  }}>
                    <Button
                      title={isSaving || isAnalyzing ? t('addProduct.saving') : t('addProduct.save')}
                      onPress={handleSave}
                      disabled={isSaving || isAnalyzing}
                      loading={isSaving || isAnalyzing}
                      style={{
                        paddingVertical: 18,
                        borderRadius: 20,
                        backgroundColor: 'transparent',
                        opacity: (isSaving || isAnalyzing) ? 0.6 : 1,
                      }}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
          </Animated.ScrollView>
        </KeyboardAvoidingView>

        {/* Kategori Picker */}
        <CategoryPicker 
          visible={pickerVisible} 
          onClose={() => setPickerVisible(false)} 
          onSelect={(path) => setSelectedPath(path)}
          initialPath={selectedPath}
        />
      </SafeAreaView>
    </View>
  );
};