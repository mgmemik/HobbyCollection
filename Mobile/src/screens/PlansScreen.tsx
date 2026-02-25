import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { getMyPlan, type PlanDetails } from '../api/plan';
import * as RNIap from 'react-native-iap';
import { SUBSCRIPTION_PRODUCTS, FALLBACK_PRICE } from '../config/subscriptions';
import { validateAppleReceipt, validateGooglePurchase } from '../api/subscriptions';

type PlanType = 'standard' | 'premium';

interface Feature {
  key: string;
  label: string;
  standard: boolean;
  premium: boolean;
  standardValue?: string;
  premiumValue?: string;
}

export const PlansScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [premiumPrice, setPremiumPrice] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const purchaseUpdateSubscription = useRef<RNIap.PurchaseUpdateSubscription | null>(null);
  const purchaseErrorSubscription = useRef<RNIap.PurchaseErrorSubscription | null>(null);
  const iapConnectionInitialized = useRef(false);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        setLoading(true);
        setError(null);
        const details = await getMyPlan();
        setPlanDetails(details);
      } catch (err: any) {
        console.error('Failed to fetch plan:', err);
        setError(err.message || 'Plan bilgisi alınamadı');
        // Default to standard plan on error
        setPlanDetails({
          plan: 'standard',
          isPremium: false,
          autoRenews: false,
          cancelAtPeriodEnd: false,
          monthlyAICredits: 50,
          features: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, []);

  // IAP bağlantısını başlat ve purchase listener'ları kur
  useEffect(() => {
    let isMounted = true;

    const initializeIAP = async () => {
      try {
        // IAP bağlantısını başlat
        await RNIap.initConnection();
        iapConnectionInitialized.current = true;

        // Purchase update listener (satın alma başarılı olduğunda)
        purchaseUpdateSubscription.current = RNIap.purchaseUpdatedListener(
          async (purchase: RNIap.Purchase) => {
            console.log('Purchase successful:', purchase);
            await handlePurchaseSuccess(purchase);
          }
        );

        // Purchase error listener (satın alma hatalarında)
        purchaseErrorSubscription.current = RNIap.purchaseErrorListener(
          (error: RNIap.PurchaseError) => {
            console.error('Purchase error:', error);
            handlePurchaseError(error);
          }
        );

        // Dinamik fiyat çekme
        if (Platform.OS === 'ios') {
          const productIds = [SUBSCRIPTION_PRODUCTS.APPLE.PREMIUM_MONTHLY];
          const products = await RNIap.getProducts(productIds);
          
          if (isMounted && products && products.length > 0) {
            const premiumProduct = products[0];
            setPremiumPrice(premiumProduct.localizedPrice || premiumProduct.price);
          } else if (isMounted) {
            console.warn('Premium product not found in App Store, using fallback price');
            setPremiumPrice(FALLBACK_PRICE.formatted);
          }
        } else if (Platform.OS === 'android') {
          // Android için henüz product oluşturulmadı, fallback kullan
          if (isMounted) {
            setPremiumPrice(FALLBACK_PRICE.formatted);
          }
        }
      } catch (err: any) {
        console.error('Failed to initialize IAP:', err);
        if (isMounted) {
          setPremiumPrice(FALLBACK_PRICE.formatted);
        }
      } finally {
        if (isMounted) {
          setPriceLoading(false);
        }
      }
    };

    initializeIAP();

    // Cleanup: listener'ları kaldır ve bağlantıyı kapat
    return () => {
      isMounted = false;
      if (purchaseUpdateSubscription.current) {
        purchaseUpdateSubscription.current.remove();
      }
      if (purchaseErrorSubscription.current) {
        purchaseErrorSubscription.current.remove();
      }
      if (iapConnectionInitialized.current) {
        RNIap.endConnection().catch((e) => {
          console.error('Error ending IAP connection:', e);
        });
      }
    };
  }, []);

  const selectedPlan: PlanType = planDetails?.isPremium ? 'premium' : 'standard';

  const features: Feature[] = [
    { key: 'aiCredits', label: t('plans.features.aiCredits') || 'Aylık AI Kredisi', standard: true, premium: true, standardValue: '50', premiumValue: '300' },
    { key: 'unlimitedProducts', label: t('plans.features.unlimitedProducts') || 'Sınırsız ürün ekler', standard: true, premium: true },
    { key: 'messageMembers', label: t('plans.features.messageMembers') || 'Üyelerle mesajlaşır', standard: true, premium: true },
    { key: 'addPhotos', label: t('plans.features.addPhotos') || 'Ürünlere fotoğraf ekler', standard: true, premium: true },
    { key: 'follow', label: t('plans.features.follow') || 'Takipleşebilir', standard: true, premium: true },
    { key: 'aiDescription', label: t('plans.features.aiDescription') || 'AI ürün description sorgulayabilir', standard: true, premium: true },
    { key: 'aiPrice', label: t('plans.features.aiPrice') || 'AI fiyat sorgulayabilir', standard: true, premium: true },
    { key: 'privateProfile', label: t('plans.features.privateProfile') || 'Kapalı profil kullanabilir', standard: true, premium: true },
    { key: 'webProfile', label: t('plans.features.webProfile') || 'Herkese açık web profil sayfası', standard: false, premium: true },
    { key: 'categories', label: t('plans.features.categories') || 'Ürünleri kategori bazlı ekler, filtreleyerek görebilir', standard: true, premium: true },
    { key: 'search', label: t('plans.features.search') || 'Arama yapısını kullanabilir', standard: true, premium: true },
    { key: 'badges', label: t('plans.features.badges') || 'Badge\'leri kullanabilir', standard: false, premium: true },
    { key: 'collectionReport', label: t('plans.features.collectionReport') || 'Collection Report kullanabilir', standard: false, premium: true },
    { key: 'csvExport', label: t('plans.features.csvExport') || 'CSV Export alabilir', standard: false, premium: true },
    { key: 'privateProducts', label: t('plans.features.privateProducts') || 'Paylaşıma kapalı ürün ekleyebilir', standard: false, premium: true },
    { key: 'showcase', label: t('plans.features.showcase') || 'Profilinde Vitrin oluşturabilir', standard: false, premium: true },
  ];

  // Satın alma başarılı olduğunda çağrılır
  const handlePurchaseSuccess = async (purchase: RNIap.Purchase) => {
    try {
      setPurchasing(true);

      // Receipt'i backend'e gönder ve validate et
      if (Platform.OS === 'ios') {
        // iOS için receipt data
        const receiptData = purchase.transactionReceipt || '';
        if (!receiptData) {
          throw new Error('Receipt data not found');
        }

        // Sandbox mu production mu otomatik algılanacak (backend'de)
        await validateAppleReceipt(receiptData);
      } else if (Platform.OS === 'android') {
        // Android için purchase token
        const purchaseToken = purchase.purchaseToken || '';
        const productId = purchase.productId || '';
        
        if (!purchaseToken || !productId) {
          throw new Error('Purchase token or product ID not found');
        }

        // Package name'i config'den al (app.json'dan)
        const packageName = 'com.gmemik.saveall'; // app.json'daki package name
        await validateGooglePurchase(packageName, productId, purchaseToken);
      }

      // Purchase'ı finish et (store'a bildir)
      await RNIap.finishTransaction({ purchase });

      // Plan bilgisini yenile
      const updatedPlan = await getMyPlan();
      setPlanDetails(updatedPlan);

      // Başarı mesajı göster
      Alert.alert(
        t('plans.purchaseSuccess') || 'Başarılı',
        t('plans.purchaseSuccessMessage') || 'Premium aboneliğiniz aktif edildi! Tüm özelliklere erişebilirsiniz.',
        [{ text: t('common.ok') || 'Tamam' }]
      );
    } catch (err: any) {
      console.error('Error validating purchase:', err);
      Alert.alert(
        t('common.error') || 'Hata',
        err.message || t('plans.purchaseValidationError') || 'Satın alma doğrulanırken bir hata oluştu. Lütfen destek ekibiyle iletişime geçin.',
        [{ text: t('common.ok') || 'Tamam' }]
      );
    } finally {
      setPurchasing(false);
    }
  };

  // Satın alma hatası olduğunda çağrılır
  const handlePurchaseError = (error: RNIap.PurchaseError) => {
    setPurchasing(false);

    // Kullanıcı iptal ettiyse hata gösterme
    if (error.code === 'E_USER_CANCELLED') {
      console.log('User cancelled purchase');
      return;
    }

    // Diğer hatalar için mesaj göster
    let errorMessage = t('plans.purchaseError') || 'Satın alma sırasında bir hata oluştu.';
    
    if (error.code === 'E_NETWORK_ERROR') {
      errorMessage = t('plans.networkError') || 'Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin.';
    } else if (error.code === 'E_SERVICE_ERROR') {
      errorMessage = t('plans.serviceError') || 'Mağaza servisi hatası. Lütfen daha sonra tekrar deneyin.';
    }

    Alert.alert(
      t('common.error') || 'Hata',
      errorMessage,
      [{ text: t('common.ok') || 'Tamam' }]
    );
  };

  // Satın alma işlemini başlat
  const handlePurchase = async (planId: PlanType) => {
    if (planId !== 'premium') {
      return;
    }

    if (!iapConnectionInitialized.current) {
      Alert.alert(
        t('common.error') || 'Hata',
        t('plans.iapNotInitialized') || 'Satın alma servisi başlatılamadı. Lütfen uygulamayı yeniden başlatın.',
        [{ text: t('common.ok') || 'Tamam' }]
      );
      return;
    }

    try {
      setPurchasing(true);

      if (Platform.OS === 'ios') {
        const productId = SUBSCRIPTION_PRODUCTS.APPLE.PREMIUM_MONTHLY;
        await RNIap.requestSubscription({ sku: productId });
      } else if (Platform.OS === 'android') {
        const productId = SUBSCRIPTION_PRODUCTS.GOOGLE.PREMIUM_MONTHLY;
        await RNIap.requestSubscription({ sku: productId });
      } else {
        throw new Error('Platform not supported');
      }
    } catch (err: any) {
      console.error('Error initiating purchase:', err);
      setPurchasing(false);
      Alert.alert(
        t('common.error') || 'Hata',
        err.message || t('plans.purchaseInitError') || 'Satın alma başlatılamadı. Lütfen tekrar deneyin.',
        [{ text: t('common.ok') || 'Tamam' }]
      );
    }
  };

  // Önceki satın alımları geri yükle
  const handleRestorePurchases = async () => {
    if (!iapConnectionInitialized.current) {
      Alert.alert(
        t('common.error') || 'Hata',
        t('plans.iapNotInitialized') || 'Satın alma servisi başlatılamadı. Lütfen uygulamayı yeniden başlatın.',
        [{ text: t('common.ok') || 'Tamam' }]
      );
      return;
    }

    try {
      setRestoring(true);

      // Tüm satın alımları geri yükle
      const purchases = await RNIap.getAvailablePurchases();

      if (purchases.length === 0) {
        Alert.alert(
          t('plans.noPurchases') || 'Satın Alma Bulunamadı',
          t('plans.noPurchasesMessage') || 'Geri yüklenecek satın alma bulunamadı.',
          [{ text: t('common.ok') || 'Tamam' }]
        );
        return;
      }

      // Her purchase'ı validate et
      let restoredCount = 0;
      for (const purchase of purchases) {
        try {
          if (Platform.OS === 'ios') {
            const receiptData = purchase.transactionReceipt || '';
            if (receiptData) {
              await validateAppleReceipt(receiptData);
              await RNIap.finishTransaction({ purchase });
              restoredCount++;
            }
          } else if (Platform.OS === 'android') {
            const purchaseToken = purchase.purchaseToken || '';
            const productId = purchase.productId || '';
            if (purchaseToken && productId) {
              const packageName = 'com.gmemik.saveall';
              await validateGooglePurchase(packageName, productId, purchaseToken);
              await RNIap.finishTransaction({ purchase });
              restoredCount++;
            }
          }
        } catch (err) {
          console.error('Error restoring purchase:', err);
        }
      }

      // Plan bilgisini yenile
      const updatedPlan = await getMyPlan();
      setPlanDetails(updatedPlan);

      if (restoredCount > 0) {
        Alert.alert(
          t('plans.restoreSuccess') || 'Başarılı',
          t('plans.restoreSuccessMessage') || `${restoredCount} satın alma geri yüklendi.`,
          [{ text: t('common.ok') || 'Tamam' }]
        );
      } else {
        Alert.alert(
          t('plans.restoreFailed') || 'Hata',
          t('plans.restoreFailedMessage') || 'Satın alımlar geri yüklenirken bir hata oluştu.',
          [{ text: t('common.ok') || 'Tamam' }]
        );
      }
    } catch (err: any) {
      console.error('Error restoring purchases:', err);
      Alert.alert(
        t('common.error') || 'Hata',
        err.message || t('plans.restoreError') || 'Satın alımlar geri yüklenirken bir hata oluştu.',
        [{ text: t('common.ok') || 'Tamam' }]
      );
    } finally {
      setRestoring(false);
    }
  };

  const getPlanName = (plan: PlanType) => {
    return plan === 'premium' ? (t('plans.premium') || 'Premium') : (t('plans.standard') || 'Standart');
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('tr-TR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch {
      return null;
    }
  };

  const getSourceLabel = (source: string | null | undefined) => {
    if (!source) return null;
    const labels: Record<string, string> = {
      AdminGrant: 'Admin',
      PromoCode: 'Promo Kodu',
      AppStore: 'App Store',
      PlayStore: 'Play Store',
    };
    return labels[source] || source;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textMuted, marginTop: 12 }}>
          {t('common.loading') || 'Yükleniyor...'}
        </Text>
      </View>
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
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: '700',
            }}>
              {t('plans.title') || 'Planlar'}
            </Text>
            <Text style={{
              color: colors.textMuted,
              fontSize: 12,
              marginTop: 2,
            }}>
              {t('plans.currentPlanLabel') || 'Mevcut Plan'}: <Text style={{ fontWeight: '600', color: selectedPlan === 'premium' ? '#FFD700' : colors.primary }}>{getPlanName(selectedPlan)}</Text>
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Premium Status Card (if premium) */}
          {planDetails?.isPremium && (
            <View style={{
              marginBottom: 16,
              padding: 16,
              borderRadius: 12,
              backgroundColor: '#FFD70015',
              borderWidth: 1,
              borderColor: '#FFD700',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                  Premium Aktif
                </Text>
              </View>
              
              {planDetails.daysRemaining !== null && planDetails.daysRemaining !== undefined && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 6 }}>
                    {planDetails.daysRemaining > 0 
                      ? `${planDetails.daysRemaining} gün kaldı`
                      : 'Bugün sona eriyor'}
                  </Text>
                </View>
              )}
              
              {!planDetails.endsAt && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="infinite-outline" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 6 }}>
                    Süresiz Premium
                  </Text>
                </View>
              )}
              
              {planDetails.endsAt && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 6 }}>
                    Bitiş: {formatDate(planDetails.endsAt)}
                  </Text>
                </View>
              )}
              
              {planDetails.source && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="gift-outline" size={14} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 6 }}>
                    Kaynak: {getSourceLabel(planDetails.source)}
                  </Text>
                </View>
              )}
              
              <View style={{ 
                marginTop: 12, 
                paddingTop: 12, 
                borderTopWidth: 1, 
                borderTopColor: '#FFD70030',
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <Ionicons name="sparkles" size={16} color="#FFD700" />
                <Text style={{ color: colors.text, fontSize: 14, marginLeft: 8 }}>
                  Aylık <Text style={{ fontWeight: '700' }}>{planDetails.monthlyAICredits}</Text> AI Kredisi
                </Text>
              </View>
            </View>
          )}

          {/* Comparison Table */}
          <View style={{
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: currentTheme === 'dark' ? '#000' : colors.text,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: currentTheme === 'dark' ? 0.3 : 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}>
            {/* Table Header */}
            <View style={{
              flexDirection: 'row',
              borderBottomWidth: 2,
              borderBottomColor: colors.border,
            }}>
              {/* Feature Column Header */}
              <View style={{
                flex: 1.8,
                minHeight: 100,
                paddingVertical: 18,
                paddingHorizontal: 16,
                backgroundColor: colors.background,
                borderRightWidth: 1,
                borderRightColor: colors.border,
                justifyContent: 'center',
              }}>
                <Text style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}>
                  {t('plans.featuresTitle') || 'Özellikler'}
                </Text>
              </View>

              {/* Standard Column Header */}
              <View style={{
                flex: 1.1,
                minHeight: 100,
                paddingVertical: 18,
                paddingHorizontal: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedPlan === 'standard' ? colors.primary + '10' : colors.surface,
                borderRightWidth: 1,
                borderRightColor: colors.border,
              }}>
                {selectedPlan === 'standard' && (
                  <View style={{
                    position: 'absolute',
                    top: 10,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                  }}>
                    <View style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                    }}>
                      <Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>
                        {t('plans.current') || 'MEVCUT'}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  <Text style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                    marginBottom: 8,
                  }}>
                    {t('plans.standard') || 'Standart'}
                  </Text>
                  <Text style={{
                    color: colors.text,
                    fontSize: 28,
                    fontWeight: '700',
                  }}>
                    {t('plans.standardPrice') || 'Free'}
                  </Text>
                </View>
              </View>

              {/* Premium Column Header */}
              <View style={{
                flex: 1.1,
                minHeight: 100,
                paddingVertical: 18,
                paddingHorizontal: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedPlan === 'premium' ? '#FFD70020' : colors.surface,
              }}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                  }}
                />
                {selectedPlan === 'premium' ? (
                  <View style={{
                    position: 'absolute',
                    top: 10,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                  }}>
                    <View style={{
                      backgroundColor: '#FFD700',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 8,
                    }}>
                      <Text style={{ color: '#000', fontSize: 9, fontWeight: '700' }}>
                        {t('plans.current') || 'MEVCUT'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={{
                    position: 'absolute',
                    top: 10,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                  }}>
                    <View style={{
                      backgroundColor: '#FFD70030',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#FFD700',
                    }}>
                      <Text style={{ color: '#B8860B', fontSize: 8, fontWeight: '700' }}>
                        {t('plans.popular') || 'POPÜLER'}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={{ alignItems: 'center', marginTop: 20 }}>
                  <Text style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                    marginBottom: 8,
                  }}>
                    {t('plans.premium') || 'Premium'}
                  </Text>
                  <View style={{ alignItems: 'center' }}>
                    {priceLoading ? (
                      <ActivityIndicator size="small" color={colors.text} style={{ marginBottom: 8 }} />
                    ) : (
                      <Text style={{
                        color: colors.text,
                        fontSize: 28,
                        fontWeight: '700',
                      }}>
                        {premiumPrice || FALLBACK_PRICE.formatted}
                      </Text>
                    )}
                    <Text style={{
                      color: colors.textMuted,
                      fontSize: 14,
                      marginTop: 2,
                    }}>
                      {t('plans.perMonth') || '/ay'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Features Rows */}
            {features.map((feature, index) => (
              <View
                key={feature.key}
                style={{
                  flexDirection: 'row',
                  borderBottomWidth: index < features.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                {/* Feature Name */}
                <View style={{
                  flex: 1.8,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: colors.background,
                  borderRightWidth: 1,
                  borderRightColor: colors.border,
                  justifyContent: 'center',
                }}>
                  <Text style={{
                    color: colors.text,
                    fontSize: 13,
                    lineHeight: 18,
                  }}>
                    {feature.label}
                  </Text>
                </View>

                {/* Standard Value */}
                <View style={{
                  flex: 1.1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selectedPlan === 'standard' ? colors.primary + '05' : colors.surface,
                  borderRightWidth: 1,
                  borderRightColor: colors.border,
                }}>
                  {feature.standardValue || feature.premiumValue ? (
                    <Text style={{
                      color: feature.standardValue ? colors.primary : '#999',
                      fontSize: 16,
                      fontWeight: '700',
                    }}>
                      {feature.standardValue || '-'}
                    </Text>
                  ) : (
                    <Ionicons
                      name={feature.standard ? 'checkmark-circle' : 'close-circle'}
                      size={24}
                      color={feature.standard ? '#4CAF50' : '#999'}
                    />
                  )}
                </View>

                {/* Premium Value */}
                <View style={{
                  flex: 1.1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selectedPlan === 'premium' ? '#FFD70010' : colors.surface,
                }}>
                  {feature.standardValue || feature.premiumValue ? (
                    <Text style={{
                      color: feature.premiumValue ? '#B8860B' : '#999',
                      fontSize: 16,
                      fontWeight: '700',
                    }}>
                      {feature.premiumValue || '-'}
                    </Text>
                  ) : (
                    <Ionicons
                      name={feature.premium ? 'checkmark-circle' : 'close-circle'}
                      size={24}
                      color={feature.premium ? '#4CAF50' : '#999'}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Purchase Buttons */}
          {!planDetails?.isPremium && (
            <View style={{
              flexDirection: 'row',
              marginTop: 20,
              marginBottom: 8,
              gap: 12,
            }}>
              {/* Standard Button */}
              <View
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 12,
                  backgroundColor: colors.border,
                  borderWidth: 2,
                  borderColor: colors.primary,
                  opacity: 0.6,
                }}
              >
                <Text style={{
                  color: colors.textMuted,
                  fontSize: 16,
                  fontWeight: '700',
                  textAlign: 'center',
                }}>
                  {t('plans.currentPlan') || 'Mevcut Plan'}
                </Text>
              </View>

              {/* Premium Button */}
              <Pressable
                onPress={() => handlePurchase('premium')}
                disabled={purchasing || restoring}
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 12,
                  backgroundColor: purchasing || restoring ? '#999' : '#FFD700',
                  borderWidth: 2,
                  borderColor: purchasing || restoring ? '#999' : '#FFD700',
                  opacity: purchasing || restoring ? 0.6 : 1,
                }}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={{
                    color: '#000',
                    fontSize: 16,
                    fontWeight: '700',
                    textAlign: 'center',
                  }}>
                    {t('plans.purchase') || 'Satın Al'}
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Restore Purchases Button */}
          <Pressable
            onPress={handleRestorePurchases}
            disabled={purchasing || restoring}
            style={{
              marginTop: 12,
              paddingVertical: 12,
              paddingHorizontal: 20,
              borderRadius: 8,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: purchasing || restoring ? 0.6 : 1,
            }}
          >
            {restoring ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={{
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                  {t('plans.restoring') || 'Geri Yükleniyor...'}
                </Text>
              </View>
            ) : (
              <Text style={{
                color: colors.text,
                fontSize: 14,
                fontWeight: '600',
                textAlign: 'center',
              }}>
                {t('plans.restorePurchases') || 'Satın Alımları Geri Yükle'}
              </Text>
            )}
          </Pressable>

          {/* Info Text */}
          <Text style={{
            color: colors.textMuted,
            fontSize: 12,
            textAlign: 'center',
            marginTop: 16,
            paddingHorizontal: 20,
          }}>
            {planDetails?.isPremium
              ? 'Premium aboneliğiniz aktif. Tüm özelliklere erişiminiz var.'
              : 'Premium satın alarak tüm özelliklere erişebilir ve aylık 300 AI kredisi kazanabilirsiniz.'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};
