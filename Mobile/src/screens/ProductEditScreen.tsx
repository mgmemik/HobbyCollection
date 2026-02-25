import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, StatusBar, Animated, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getProduct, ProductDetail, updateProduct } from '../api/products';
import { Category, fetchCategoryPath } from '../api/categories';
import { CategoryPicker } from '../components/CategoryPicker';
import { TagInput } from '../components/ui/TagInput';
import { PhotoAnalyzer } from '../components/PhotoAnalyzer';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { fetchUserPreferences } from '../api/userPreferences';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../api/auth';
import { photoAnalysisAPI } from '../api/photoAnalysis';
import i18n from '../i18n';
import { getOperationCosts, AIOperationCost } from '../api/aiCredits';
import { ProductBadgeType } from '../components/ProductBadge';
import { suggestCategoryByAI } from '../api/categories';
import { usePremium } from '../hooks/usePremium';

export const ProductEditScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const toast = useToast();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { productId } = route.params as { productId: string };

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [combined, setCombined] = useState('');
  const [selectedUris, setSelectedUris] = useState<{ uri: string; name?: string; type?: string }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [price, setPrice] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [commentsEnabled, setCommentsEnabled] = useState<boolean>(true);
  const [scrollY] = useState(new Animated.Value(0));
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedPath, setSelectedPath] = useState<Category[] | null>(null);
  const [currency, setCurrency] = useState<string>('TRY');
  const [isEstimatingPrice, setIsEstimatingPrice] = useState<boolean>(false);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState<boolean>(false);
  const [aiOperationCosts, setAiOperationCosts] = useState<AIOperationCost[]>([]);
  
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
    (navigation as any).navigate('Plans');
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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const token = (await AsyncStorage.getItem('auth_token')) || '';
        const data = await getProduct(productId, token);
        setProduct(data);
        const initialCombined = [data.title || '', data.description || '', data.hashtags || ''].join('\n');
        setCombined(initialCombined);
        if (typeof (data as any).price !== 'undefined' && (data as any).price !== null) {
          setPrice(String((data as any).price));
        }
        if (typeof (data as any).isPublic === 'boolean') setIsPublic((data as any).isPublic as boolean);
        if (typeof (data as any).commentsEnabled === 'boolean') setCommentsEnabled((data as any).commentsEnabled as boolean);
        
        // Load badge states
        if (typeof (data as any).isRare === 'boolean') setIsRare((data as any).isRare);
        if (typeof (data as any).isMint === 'boolean') setIsMint((data as any).isMint);
        if (typeof (data as any).isGraded === 'boolean') setIsGraded((data as any).isGraded);
        if (typeof (data as any).isSigned === 'boolean') setIsSigned((data as any).isSigned);
        if (typeof (data as any).isLimited === 'boolean') setIsLimited((data as any).isLimited);
        if (typeof (data as any).isFeatured === 'boolean') setIsFeatured((data as any).isFeatured);
        
        // Load category path with translations if categoryId exists
        if ((data as any).categoryId) {
          try {
            const categoryPath = await fetchCategoryPath((data as any).categoryId);
            setSelectedPath(categoryPath);
          } catch (e) {
            // Ignore errors, category path is optional
          }
        }
        
        // Load user currency preference
        try {
          const prefs = await fetchUserPreferences(token);
          if (prefs?.currency) {
            setCurrency(prefs.currency);
          }
        } catch {}
      } catch (e) {
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  // Para birimini sayfa her açıldığında güncelle
  useFocusEffect(
    useCallback(() => {
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
    }, [])
  );

  const handleSave = useCallback(async () => {
     if (isAnalyzing) {
       toast.show({ type: 'info', message: t('editProduct.waiting'), subMessage: t('editProduct.analyzing') });
       return;
     }
     try {
       const token = (await AsyncStorage.getItem('auth_token')) || '';
       const lines = combined.split(/\n/);
       const finalTitle = lines[0] || product?.title || 'Untitled';
       
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
       // Description'ı birleştir (yeni satırları koru) - 1. satırdan (index 1) hashtag'lerin başladığı yere kadar
       const finalDescription = lines.slice(1, descriptionEndIndex).join('\n').trim() || '';
       // Hashtags: Description'dan sonraki satırlar
       const finalHashtags = (lines.slice(descriptionEndIndex).join(' ').trim()) || '';

       // Mevcut fotoğrafları (blobUrl'leri olan) yeni fotoğraflardan ayır
       // Sadece local URI'leri olan (file://, content:// veya ph:// ile başlayan) fotoğrafları gönder
       // BlobUrl'ler (http:// veya https:// ile başlayan) mevcut fotoğraflar, gönderilmemeli
       const newPhotos = selectedUris.filter(p => {
         const uri = p.uri;
         // Local URI kontrolü: file://, content:// veya ph:// ile başlayanlar yeni fotoğraflar
         // BlobUrl'ler (http:// veya https://) otomatik olarak filtrelenir çünkü local URI değiller
         return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
       });

      await updateProduct(productId, {
        title: finalTitle,
        description: finalDescription,
        hashtags: finalHashtags,
        price: price.trim() ? Number(price) : undefined,
        isPublic,
        commentsEnabled,
        categoryId: selectedPath && selectedPath.length > 0 ? selectedPath[selectedPath.length - 1].id : undefined,
        photos: newPhotos.length > 0 ? newPhotos.map(p => ({ uri: p.uri, name: p.name || 'photo.jpg', type: p.type || 'image/jpeg' })) : undefined,
        removePhotoIds: removedPhotoIds,
        // Badge fields
        isRare,
        isMint,
        isGraded,
        isSigned,
        isLimited,
        isFeatured,
      }, token);

       toast.show({ type: 'success', message: t('common.success'), subMessage: t('editProduct.productUpdated') });
       navigation.goBack();
     } catch (e: any) {
       toast.show({ type: 'error', message: t('common.error'), subMessage: e?.message || t('editProduct.productUpdateError') });
     }
  }, [combined, isAnalyzing, selectedUris, removedPhotoIds, product, price, isPublic, commentsEnabled, selectedPath, productId, navigation, toast, isRare, isMint, isGraded, isSigned, isLimited, isFeatured]);

  const handleSuggestCategory = useCallback(async () => {
    if (isAnalyzing || isSuggestingCategory) return;

    const hasAnyPhoto =
      (selectedUris && selectedUris.length > 0) ||
      ((product?.photos?.length ?? 0) > 0);

    if (!hasAnyPhoto) {
      toast.show({
        type: 'error',
        message: t('common.error'),
        subMessage: t('editProduct.atLeastOnePhoto'),
      });
      return;
    }

    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      toast.show({ type: 'error', message: t('addProduct.authRequired') || 'Authentication required' });
      return;
    }

    const productText =
      (combined || '').trim() ||
      [product?.title, product?.description, product?.hashtags].filter(Boolean).join('\n');

    const descriptionLength = productText.trim().length;
    
    if (descriptionLength < 10) {
      toast.show({
        type: 'error',
        message: t('common.error'),
        subMessage: t('addProduct.minDescriptionLength') || 'Lütfen en az 10 karakterlik ürün açıklaması girin',
      });
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
              onPress: () => (navigation as any).navigate('Plans')
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
  }, [combined, isAnalyzing, isSuggestingCategory, product, selectedUris, t, toast]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar 
        barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.background}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {/* Top row: back + title */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => navigation.goBack()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', flex: 1 }} numberOfLines={1}>{t('editProduct.title')}</Text>
          </View>
        </View>

        <Animated.ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          style={{ flex: 1 }}
        >
          <View style={{ paddingTop: 16 }}>
            {/* Fotoğraf Yükleme Kartı */}
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
                key="photo-analyzer-edit"
                maxPhotos={10}
                onSelectionChange={(list) => {
                  // Başlangıçta product.photos vardı; kullanıcı thumbnail'den kaldırınca tespit et
                  if (product?.photos?.length) {
                    const currentUris = new Set(list.map(x => x.uri));
                    const removed = (product.photos as any[]).filter(ph => !currentUris.has(ph.blobUrl)).map(ph => String(ph.id))
                    setRemovedPhotoIds(removed);
                  }
                  setSelectedUris(list);
                }}
                compact={false}
                enableAnalysis={false}
                onAnalyzingChange={setIsAnalyzing}
                useEnhancedAnalysis={false}
                initialPhotos={(product?.photos || []).map(ph => ({ uri: ph.blobUrl }))}
              />

              {isAnalyzing && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '15', marginHorizontal: 4, marginTop: 12, marginBottom: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '30' }}>
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{t('editProduct.analyzing')}</Text>
                </View>
              )}
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('editProduct.photoNote')}</Text>
            </View>

            {/* Ürün Bilgileri Kartı */}
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
                justifyContent: 'space-between',
                marginBottom: 16 
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
                      fontWeight: '600' 
                    }}>
                      {t('addProduct.productInfo')}
                    </Text>
                  </View>
                </View>
                
                {/* AI Check Butonu */}
                <Pressable
                  onPress={async () => {
                    if (isAnalyzing) return;
                    
                    // Mevcut fotoğrafları topla (hem initialPhotos hem de yeni seçilenler)
                    const allPhotos = [
                      ...(product?.photos || []).map(ph => ({
                        uri: ph.blobUrl,
                        name: `photo_${ph.id}.jpg`,
                        type: 'image/jpeg'
                      })),
                      ...selectedUris.filter(p => 
                        p.uri.startsWith('file://') || 
                        p.uri.startsWith('content://') || 
                        p.uri.startsWith('ph://')
                      )
                    ];
                    
                    if (allPhotos.length === 0) {
                      toast.show({ 
                        type: 'error', 
                        message: t('common.error'),
                        subMessage: t('editProduct.atLeastOnePhoto')
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
                      
                      // Axios tabanlı photoAnalysisAPI kullan
                      const analysisResponse = await photoAnalysisAPI.analyzePhotosEnhanced(
                        allPhotos as any,
                        langParam
                      );
                      
                      if (analysisResponse.success && analysisResponse.result) {
                        const result = analysisResponse.result;
                        
                        // AddScreen'deki gibi sonuçları işle
                        const brand = (result.finalIdentification.brand || '').trim();
                        const model = (result.finalIdentification.model || '').trim();
                        const productName = (result.finalIdentification.productName || '').trim();
                        const titleFromBrandModel = [brand, model].filter(Boolean).join(' ');
                        const computedTitle = productName || titleFromBrandModel || t('editProduct.notIdentified');
                        
                        // Backend'den gelen hashtag'leri kullan (AddScreen'deki gibi)
                        const backendHashtags = result?.hashtags || result?.geminiHashtags;
                        let enhancedHashtags: string[] = [];
                        
                        if (backendHashtags && Array.isArray(backendHashtags) && backendHashtags.length > 0) {
                          // Backend'den gelen hashtag'leri kullan
                          enhancedHashtags = backendHashtags.filter((tag: string) => tag && tag.trim().length > 0);
                        } else {
                          // Fallback: Frontend'de üret (AddScreen'deki GenerateHashtagsFromEnhanced mantığı)
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
                        
                        // Combined alanını güncelle (AddScreen'deki format: Başlık, Boş satır, Hashtag'ler)
                        const combinedValue = `${computedTitle}\n\n${hashtagsStr}`;
                        setCombined(combinedValue);
                        
                        // Scroll'u en üste al (açıklama alanı uzunsa scroll aşağıda kalıyor)
                        setTimeout(() => {
                          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                        }, 100);
                        
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
                      console.error('AI analiz hatası:', error);
                      
                      // Hata mesajını daha kullanıcı dostu hale getir
                      let errorMessage = error?.message || t('editProduct.analysisError');
                      
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
                              onPress: () => (navigation as any).navigate('Plans')
                            }
                          ]
                        );
                        return; // Toast göstermeden çık
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
                  setCombined(t);
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
                  const hasAnyPhoto = (selectedUris?.length ?? 0) > 0 || (product?.photos?.length ?? 0) > 0;
                  const productText = (combined || '').trim() || [product?.title, product?.description, product?.hashtags].filter(Boolean).join('\n');
                  const hasMinDescription = productText.trim().length >= 10;
                  const isButtonEnabled = !isAnalyzing && !isSuggestingCategory && hasAnyPhoto && hasMinDescription;
                  
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
                onPress={() => setPickerVisible(true)}
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ 
                    color: selectedPath ? colors.text : colors.textMuted, 
                    fontSize: 15,
                    fontWeight: selectedPath ? '600' : '400',
                    flex: 1,
                  }} numberOfLines={1}>
                    {selectedPath ? selectedPath.map(p => p.name).join(' / ') : (product?.category || t('addProduct.selectCategory'))}
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

            {/* Gelişmiş Ayarlar Kartı - Kompakt */}
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
                  <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 20 }} />

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
                          // Edit sayfasında combined alanında açıklama varsa aktif
                          const hasDescription = combined.trim().length > 0;
                          if (!hasDescription || isEstimatingPrice) return;
                          
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
                                    onPress: () => (navigation as any).navigate('Plans')
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
                        disabled={!combined.trim() || isEstimatingPrice}
                        style={{
                          alignItems: 'center',
                          backgroundColor: combined.trim() && !isEstimatingPrice ? colors.primary + '10' : colors.border,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: combined.trim() && !isEstimatingPrice ? colors.primary + '30' : colors.border,
                          opacity: combined.trim() && !isEstimatingPrice ? 1 : 0.5,
                        }}
                      >
                        {isEstimatingPrice ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="sparkles" size={14} color={combined.trim() ? colors.primary : colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={{
                          color: combined.trim() ? colors.primary : colors.textMuted,
                          fontSize: 12,
                          fontWeight: '600',
                        }}>
                                {t('addProduct.aiCheck') || 'AI Check'}
                              </Text>
                            </View>
                            {/* AI Credit Cost - Alt Satır */}
                            <Text style={{
                              color: combined.trim() ? colors.primary : colors.textMuted,
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
                        pointerEvents: 'none', // Input'a etki etmemesi için
                      }}>
                        <Text style={{ 
                          color: colors.textMuted, 
                          fontSize: 16,
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
                        name={isPublic ? 'globe' : 'lock-closed'} 
                        size={20} 
                        color={colors.primary} 
                        style={{ marginRight: 12 }}
                      />
                      <View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{t('addProduct.sharing')}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{isPublic ? t('addProduct.public') : t('addProduct.private')}</Text>
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
                        name={commentsEnabled ? 'chatbubbles' : 'chatbubbles-outline'} 
                        size={20} 
                        color={colors.primary} 
                        style={{ marginRight: 12 }}
                      />
                      <View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{t('addProduct.comments')}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{commentsEnabled ? t('addProduct.commentsOn') : t('addProduct.commentsOff')}</Text>
                      </View>
                    </View>
                    <Switch value={commentsEnabled} onValueChange={setCommentsEnabled} thumbColor={colors.primary} trackColor={{ true: colors.accent + '60', false: colors.border }} />
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

            {/* Kaydet Butonu */}
            <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
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
                  title={isAnalyzing ? t('editProduct.waiting') : t('editProduct.save')}
                  onPress={handleSave}
                  disabled={isAnalyzing}
                  loading={isAnalyzing}
                  style={{
                    paddingVertical: 18,
                    borderRadius: 20,
                    backgroundColor: 'transparent',
                    opacity: isAnalyzing ? 0.6 : 1,
                  }}
                />
              </View>
            </View>
          </View>
        </Animated.ScrollView>

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

