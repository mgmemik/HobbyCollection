import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getUserProducts, UserProduct } from '../api/products';
import { sendCollectionCsvToEmail } from '../api/reports';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchRoots, fetchChildren, Category } from '../api/categories';
import { CategorySelect } from '../components/CategorySelect';
import { useTranslation } from 'react-i18next';
import { fetchUserPreferences } from '../api/userPreferences';
import { API_BASE_URL } from '../api/auth';
import i18n from '../i18n';
import { AICreditIndicator } from '../components/AICreditIndicator';
import { getOperationCosts, AIOperationCost } from '../api/aiCredits';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from '../components/ui/Toast';
import { usePremium } from '../hooks/usePremium';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const formatPrice = (price: number | undefined, currency: string): string => {
  if (!price) return '-';
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const CollectionReportScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { token } = useAuth();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<UserProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<string>('TRY');
  const [aiOperationCosts, setAiOperationCosts] = useState<AIOperationCost[]>([]);
  const [estimatingPrices, setEstimatingPrices] = useState<Record<string, boolean>>({});
  const [creditRefreshTrigger, setCreditRefreshTrigger] = useState<number>(0);
  const [exportingCsv, setExportingCsv] = useState(false);
  const toast = useToast();
  const { isPremium, checkFeatureAccess, loading: premiumLoading } = usePremium();
  const [showPremiumOverlay, setShowPremiumOverlay] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  
  const navigateToPlans = () => {
    (navigation as any).navigate('Plans');
  };
  
  // Premium değilse 6 saniye sonra overlay göster
  useEffect(() => {
    if (!premiumLoading && !isPremium) {
      const timer = setTimeout(() => {
        setShowPremiumOverlay(true);
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 6000);
      
      return () => clearTimeout(timer);
    }
  }, [isPremium, premiumLoading]);
  
  // Category filter states
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [childCategories, setChildCategories] = useState<Category[]>([]);
  const [selectedChildCategory, setSelectedChildCategory] = useState<string>('');
  const [selectedChildCategoryId, setSelectedChildCategoryId] = useState<string>('');
  const [grandChildCategories, setGrandChildCategories] = useState<Category[]>([]);
  const [selectedGrandChildCategory, setSelectedGrandChildCategory] = useState<string>('');
  const [selectedGrandChildCategoryId, setSelectedGrandChildCategoryId] = useState<string>('');
  const [allGrandChildIdsFull, setAllGrandChildIdsFull] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    loadAICosts();
  }, []);

  const loadAICosts = async () => {
    try {
      const costs = await getOperationCosts();
      setAiOperationCosts(costs);
    } catch (error) {
      console.error('Failed to load AI operation costs:', error);
    }
  };

  // Kategorileri ürünler yüklendikten sonra yükle
  useEffect(() => {
    if (products.length > 0) {
      loadCategories();
    }
  }, [products, i18n.language]);

  useEffect(() => {
    applyFilters();
  }, [products, selectedCategoryId, selectedChildCategoryId, selectedGrandChildCategoryId, childCategories, grandChildCategories, allGrandChildIdsFull]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!token) return;
      
      // Load user currency preference
      try {
        const prefs = await fetchUserPreferences(token);
        if (prefs?.currency) {
          setCurrency(prefs.currency);
        }
      } catch {}
      
      const data = await getUserProducts(token);
      setProducts(data);
    } catch (e) {
      console.error('Error loading products:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      if (!token) return;
      
      // Backend'den optimize edilmiş endpoint kullan
      const language = i18n.language || 'en';
      const langParam = language === 'tr' ? 'tr' : 'en';
      const response = await fetch(`${API_BASE_URL}/api/categories/roots-with-products?language=${langParam}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const categoriesWithProducts = await response.json();
        console.log('Categories with products (from backend):', categoriesWithProducts.map((c: Category) => c.name));
        setCategories(categoriesWithProducts);
      } else {
        // Fallback: Tüm kategorileri yükle
        console.warn('Backend endpoint failed, using fallback');
        const allCats = await fetchRoots();
        setCategories(allCats);
      }
    } catch (e) {
      console.error('Error loading categories:', e);
      // Hata durumunda tüm kategorileri göster
      try {
        const allCats = await fetchRoots();
        setCategories(allCats);
      } catch (e2) {
        console.error('Error loading all categories:', e2);
      }
    }
  };

  // selectedCategory değiştiğinde ID'yi set et
  useEffect(() => {
    if (selectedCategory) {
      const cat = categories.find(c => c.name === selectedCategory);
      if (cat) {
        setSelectedCategoryId(cat.id);
      }
    } else {
      setSelectedCategoryId('');
    }
  }, [selectedCategory, categories]);

  // Load children when parent category changes
  useEffect(() => {
    (async () => {
      try {
        setSelectedChildCategory('');
        setSelectedChildCategoryId('');
        setSelectedGrandChildCategory('');
        setSelectedGrandChildCategoryId('');
        setGrandChildCategories([]);
        setAllGrandChildIdsFull([]);
        if (!selectedCategory || !token) {
          setChildCategories([]);
          return;
        }
        const parent = categories.find(c => c.name === selectedCategory);
        if (!parent) {
          setChildCategories([]);
          setAllGrandChildIdsFull([]);
          return;
        }
        
        // Backend'den optimize edilmiş endpoint kullan
        const language = i18n.language || 'en';
        const langParam = language === 'tr' ? 'tr' : 'en';
        const response = await fetch(`${API_BASE_URL}/api/categories/children-with-products/${parent.id}?language=${langParam}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        let childrenWithProducts: Category[] = [];
        if (response.ok) {
          childrenWithProducts = await response.json();
          console.log('Child categories with products (from backend):', childrenWithProducts.map((c: Category) => c.name));
          setChildCategories(childrenWithProducts);
        } else {
          // Fallback: Normal endpoint kullan
          childrenWithProducts = await fetchChildren(parent.id);
          setChildCategories(childrenWithProducts);
        }

        // Fetch grandchildren for ALL children so parent filter includes every depth-2 and depth-3 option
        try {
          const grandLists = await Promise.all(
            childrenWithProducts.map(async (ch) => {
              try {
                const grandResponse = await fetch(`${API_BASE_URL}/api/categories/children-with-products/${ch.id}?language=${langParam}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                });
                if (grandResponse.ok) {
                  return await grandResponse.json();
                } else {
                  return await fetchChildren(ch.id);
                }
              } catch {
                return await fetchChildren(ch.id);
              }
            })
          );
          const ids = grandLists.flat().map((g: Category) => g.id);
          setAllGrandChildIdsFull(ids);
        } catch (e) {
          console.error('Error loading all grandchildren:', e);
          setAllGrandChildIdsFull([]);
        }
      } catch (e) {
        console.error('Error loading child categories:', e);
        setChildCategories([]);
        setAllGrandChildIdsFull([]);
      }
    })();
  }, [selectedCategory, categories, token, i18n.language]);

  // selectedChildCategory değiştiğinde ID'yi set et
  useEffect(() => {
    if (selectedChildCategory) {
      const cat = childCategories.find(c => c.name === selectedChildCategory);
      if (cat) {
        setSelectedChildCategoryId(cat.id);
      }
    } else {
      setSelectedChildCategoryId('');
    }
  }, [selectedChildCategory, childCategories]);

  // Load grandchildren when child category changes
  useEffect(() => {
    (async () => {
      try {
        setSelectedGrandChildCategory('');
        setSelectedGrandChildCategoryId('');
        if (!selectedChildCategory || !token) {
          setGrandChildCategories([]);
          return;
        }
        const child = childCategories.find(c => c.name === selectedChildCategory);
        if (!child) {
          setGrandChildCategories([]);
          return;
        }
        
        // Backend'den optimize edilmiş endpoint kullan
        const language = i18n.language || 'en';
        const langParam = language === 'tr' ? 'tr' : 'en';
        const response = await fetch(`${API_BASE_URL}/api/categories/children-with-products/${child.id}?language=${langParam}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const grandchildrenWithProducts = await response.json();
          console.log('Grandchild categories with products (from backend):', grandchildrenWithProducts.map((c: Category) => c.name));
          setGrandChildCategories(grandchildrenWithProducts);
        } else {
          // Fallback: Normal endpoint kullan
          const allGrandchildren = await fetchChildren(child.id);
          setGrandChildCategories(allGrandchildren);
        }
      } catch (e) {
        console.error('Error loading grandchild categories:', e);
        setGrandChildCategories([]);
      }
    })();
  }, [selectedChildCategory, childCategories, token, i18n.language]);

  const applyFilters = () => {
    let filtered = [...products];

    // Apply category filter by ID (more reliable than name)
    if (selectedGrandChildCategoryId) {
      filtered = filtered.filter(p => p.categoryId === selectedGrandChildCategoryId);
    } else if (selectedChildCategoryId) {
      // Child category seçildiğinde, o child ve onun tüm alt kategorilerindeki ürünleri göster
      const allowedIds = new Set<string>([
        selectedChildCategoryId,
        ...grandChildCategories.map(c => c.id),
      ]);
      filtered = filtered.filter(item => item.categoryId && allowedIds.has(item.categoryId));
    } else if (selectedCategoryId) {
      // Ana kategori seçildiğinde, o kategori ve tüm alt kategorilerindeki (2. ve 3. seviye) ürünleri göster
      const allowedIds = new Set<string>([
        selectedCategoryId,
        ...childCategories.map(c => c.id),
        ...allGrandChildIdsFull,
      ]);
      filtered = filtered.filter(item => item.categoryId && allowedIds.has(item.categoryId));
    }

    setFilteredProducts(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalPrice = filteredProducts.reduce((sum, p) => sum + (p.price || 0), 0);
  const totalCount = filteredProducts.length;

  const handleExportCsv = async () => {
    if (!token || exportingCsv) return;
    setExportingCsv(true);
    try {
      const language = i18n.language === 'tr' ? 'tr' : 'en';

      const categoryId =
        selectedGrandChildCategoryId ||
        selectedChildCategoryId ||
        selectedCategoryId ||
        null;

      // Leaf seçiliyse (grandchild) descendants gerekmez; diğerlerinde true.
      const includeDescendants = !selectedGrandChildCategoryId;

      await sendCollectionCsvToEmail(token, {
        categoryId,
        includeDescendants,
        language,
      });

      const filterLabel = (() => {
        if (selectedGrandChildCategory) {
          const parts = [selectedCategory, selectedChildCategory, selectedGrandChildCategory].filter(Boolean);
          return parts.join(' / ');
        }
        if (selectedChildCategory) {
          const parts = [selectedCategory, selectedChildCategory].filter(Boolean);
          return parts.join(' / ');
        }
        if (selectedCategory) return selectedCategory;
        return t('categories.allCategories') || 'Tüm Kategoriler';
      })();

      toast.show({
        type: 'success',
        message: t('collectionReport.csvEmailQueued') || 'CSV gönderimi kuyruğa alındı',
        subMessage:
          t('collectionReport.csvEmailQueuedDesc', { filter: filterLabel }) ||
          `${filterLabel} filtresine ait liste hazır olunca e-posta adresinize gönderilecek.`,
      });
    } catch (e: any) {
      toast.show({
        type: 'error',
        message: t('collectionReport.exportFailed') || 'CSV gönderilemedi',
        subMessage: e?.message || '',
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleEstimatePrice = async (product: UserProduct) => {
    if (estimatingPrices[product.id] || !token) return;
    
    setEstimatingPrices(prev => ({ ...prev, [product.id]: true }));
    
    try {
      // Android için timeout ile fetch helper
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
      
      // Ürünün açıklamasını almak için önce ürün detayını çek
      const productDetailResponse = await fetchWithTimeout(`${API_BASE_URL}/api/products/${product.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }, 30000); // 30 saniye timeout
      
      if (!productDetailResponse.ok) {
        throw new Error('Ürün detayı alınamadı');
      }
      
      const productDetail = await productDetailResponse.json();
      const description = productDetail.description || productDetail.title || '';
      
      if (!description.trim()) {
        toast.show({ 
          type: 'error', 
          message: t('addProduct.noDescription') || 'Ürün açıklaması bulunamadı' 
        });
        return;
      }
      
      const language = i18n.language || 'en';
      const langParam = language === 'tr' ? 'tr' : 'en';
      
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/products/estimate-price`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description,
          language: langParam,
          currency: currency,
        }),
      }, 60000); // 60 saniye timeout
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Price estimation failed: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.estimatedPrice) {
        // Ürünü güncelle (timeout ile)
        await fetchWithTimeout(`${API_BASE_URL}/api/products/${product.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            price: data.estimatedPrice.toString(),
          }).toString(),
        }, 30000); // 30 saniye timeout
        
        // Local state'i güncelle
        setProducts(prev => prev.map(p => 
          p.id === product.id ? { ...p, price: data.estimatedPrice } : p
        ));
        
        // Kredi bakiyesini güncelle
        setCreditRefreshTrigger(prev => prev + 1);
        
        toast.show({ 
          type: 'success', 
          message: t('addProduct.priceEstimated') || 'Fiyat tahmin edildi',
          subMessage: `${data.estimatedPrice} ${data.currency || currency}`
        });
      } else {
        // Başarısız durumda da bakiyeyi güncelle (kredi kullanılmış olabilir)
        setCreditRefreshTrigger(prev => prev + 1);
        
        toast.show({ 
          type: 'info', 
          message: t('addProduct.priceNotEstimated') || 'Fiyat tahmin edilemedi',
          subMessage: data.error || data.reasoning || ''
        });
      }
    } catch (error: any) {
      // Hata durumunda da bakiyeyi güncelle (kredi kullanılmış olabilir)
      setCreditRefreshTrigger(prev => prev + 1);
      
      // Network hatası için daha açıklayıcı mesaj
      let errorMessage = error?.message || '';
      if (error?.message && error.message.includes('Network request failed')) {
        errorMessage = 'Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.';
      } else if (error?.message && error.message.includes('timeout')) {
        errorMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
      }
      
      toast.show({ 
        type: 'error', 
        message: t('addProduct.priceEstimationError') || 'Fiyat tahmin hatası',
        subMessage: errorMessage
      });
    } finally {
      setEstimatingPrices(prev => ({ ...prev, [product.id]: false }));
    }
  };

  const renderProductRow = ({ item, index }: { item: UserProduct; index: number }) => {
    const isEven = index % 2 === 0;
    const hasPrice = item.price !== null && item.price !== undefined;
    const isEstimating = estimatingPrices[item.id] || false;
    const priceDetectionCost = aiOperationCosts.find(c => c.operationType === 'PriceDetection')?.creditCost ?? 1;
    
    return (
      <View
        style={{
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: isEven ? colors.surface : (currentTheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        alignItems: 'center',
        }}
      >
        <View style={{ width: 40, justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '500' }}>
            {index + 1}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            navigation.navigate('ProductDetail', { productId: item.id });
          }}
          style={{ flex: 1, justifyContent: 'center', marginRight: 12 }}
        >
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
            {item.title || 'Untitled'}
          </Text>
          {item.category && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {item.category}
            </Text>
          )}
        </Pressable>
        <View style={{ width: 120, justifyContent: 'center', alignItems: 'flex-end', marginRight: 8 }}>
          {hasPrice ? (
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
              {formatPrice(item.price, currency)}
            </Text>
          ) : (
            <Pressable
              onPress={() => handleEstimatePrice(item)}
              disabled={isEstimating}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primary + '15',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.primary + '30',
                opacity: isEstimating ? 0.6 : 1,
              }}
            >
              {isEstimating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>
                    AI Check
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 9, marginLeft: 4 }}>
                    ({priceDetectionCost})
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
        <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
          <Pressable
            onPress={() => {
              navigation.navigate('ProductEdit', { productId: item.id });
            }}
            style={{
              backgroundColor: colors.primary + '15',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.primary + '30',
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
              {t('common.edit') || 'Edit'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ marginRight: 16 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{
          color: colors.text,
          fontSize: 20,
          fontWeight: '700',
          flex: 1,
        }}>
          {t('collectionReport.title') || 'Koleksiyon Raporu'}
        </Text>
        <Pressable
          onPress={() => {
            if (!isPremium) {
              checkFeatureAccess('CsvExport', navigateToPlans);
              return;
            }
            handleExportCsv();
          }}
          disabled={exportingCsv || loading || !token}
          style={{
            marginRight: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: !isPremium ? '#FFD700' : colors.border,
            backgroundColor: !isPremium 
              ? '#FFD70015' 
              : exportingCsv 
                ? (currentTheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') 
                : colors.surface,
            opacity: exportingCsv || loading || !token ? 0.6 : 1,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {exportingCsv ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              {!isPremium && (
                <Ionicons name="lock-closed" size={14} color="#FFD700" style={{ marginRight: 4 }} />
              )}
              <Ionicons name="download-outline" size={18} color={!isPremium ? '#FFD700' : colors.text} />
              <Text style={{ marginLeft: 6, color: !isPremium ? '#FFD700' : colors.text, fontSize: 12, fontWeight: '700' }}>
                CSV
              </Text>
            </>
          )}
        </Pressable>
        {/* AI Credits Indicator */}
        <AICreditIndicator size="small" showLabel={false} refreshTrigger={creditRefreshTrigger} />
      </View>

      {/* Category Filters */}
      <View style={{
        backgroundColor: colors.surface,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <CategorySelect
            categories={categories}
            selectedCategory={selectedCategory}
            onSelect={(cat) => {
              setSelectedCategory(cat);
              setSelectedChildCategory('');
              setSelectedGrandChildCategory('');
              if (!cat) {
                // "All Categories" seçildiğinde tüm state'leri temizle
                setSelectedCategoryId('');
                setSelectedChildCategoryId('');
                setSelectedGrandChildCategoryId('');
              }
            }}
            placeholder={t('categories.selectCategory')}
          />
          {childCategories.length > 0 && (
            <View style={{ marginLeft: 8, marginTop: 8 }}>
              <CategorySelect
                categories={childCategories}
                selectedCategory={selectedChildCategory}
                onSelect={(cat) => {
                  setSelectedChildCategory(cat);
                  setSelectedGrandChildCategory('');
                  if (!cat) {
                    // Alt kategori temizlendiğinde
                    setSelectedChildCategoryId('');
                    setSelectedGrandChildCategoryId('');
                  }
                }}
                placeholder={t('search.subCategory')}
              />
            </View>
          )}
          {grandChildCategories.length > 0 && (
            <View style={{ marginLeft: 8, marginTop: 8 }}>
              <CategorySelect
                categories={grandChildCategories}
                selectedCategory={selectedGrandChildCategory}
                onSelect={(cat) => {
                  setSelectedGrandChildCategory(cat);
                  if (cat) {
                    const selectedGrandchild = grandChildCategories.find(c => c.name === cat);
                    if (selectedGrandchild) {
                      setSelectedGrandChildCategoryId(selectedGrandchild.id);
                    }
                  } else {
                    setSelectedGrandChildCategoryId('');
                  }
                }}
                placeholder={t('search.subCategory2')}
              />
            </View>
          )}
        </View>
      </View>

      {/* Table Header */}
      <View style={{
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.primary,
      }}>
        <View style={{ width: 40 }}>
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            #
          </Text>
        </View>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            {t('collectionReport.product') || 'Ürün'}
          </Text>
        </View>
        <View style={{ width: 120, alignItems: 'flex-end', marginRight: 8 }}>
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            {t('collectionReport.price') || 'Fiyat'}
          </Text>
        </View>
        <View style={{ width: 60, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            {t('common.edit') || 'Edit'}
          </Text>
        </View>
      </View>

      {/* Product List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 16, marginTop: 16, textAlign: 'center' }}>
            {t('collectionReport.noProducts') || 'Ürün bulunamadı'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductRow}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* Total Summary Footer */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 2,
        borderTopColor: colors.primary,
        paddingVertical: 16,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 8,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
            {t('collectionReport.totalProducts') || 'Toplam Ürün:'}
          </Text>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {totalCount}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
            {t('collectionReport.totalPrice') || 'Toplam Fiyat:'}
          </Text>
          <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>
            {formatPrice(totalPrice, currency)}
          </Text>
        </View>
      </View>

      {/* Premium Overlay - 6 saniye sonra gösterilir */}
      {showPremiumOverlay && (
        <Animated.View 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            opacity: overlayOpacity,
          }}
          pointerEvents="auto"
        >
          <BlurView 
            intensity={20} 
            tint={currentTheme === 'dark' ? 'dark' : 'light'}
            style={{ 
              flex: 1, 
              justifyContent: 'center', 
              alignItems: 'center',
              paddingHorizontal: 32,
            }}
          >
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 24,
              padding: 32,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
              elevation: 12,
              maxWidth: 340,
              width: '100%',
            }}>
              {/* Premium Icon */}
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#FFD700' + '20',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <Ionicons name="lock-closed" size={40} color="#FFD700" />
              </View>
              
              {/* Title */}
              <Text style={{
                fontSize: 24,
                fontWeight: '700',
                color: colors.text,
                textAlign: 'center',
                marginBottom: 12,
              }}>
                {t('plans.featureTitle')}
              </Text>
              
              {/* Description */}
              <Text style={{
                fontSize: 15,
                color: colors.textMuted,
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: 24,
              }}>
                {t('plans.collectionReportDesc')}
              </Text>
              
              {/* Features */}
              <View style={{ marginBottom: 24, width: '100%' }}>
                {[
                  t('plans.feature.detailedReport'),
                  t('plans.feature.csvExport'),
                  t('plans.feature.aiPricing'),
                ].map((feature, index) => (
                  <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFD700" style={{ marginRight: 10 }} />
                    <Text style={{ color: colors.text, fontSize: 14 }}>{feature}</Text>
                  </View>
                ))}
              </View>
              
              {/* Upgrade Button */}
              <Pressable
                onPress={navigateToPlans}
                style={{
                  width: '100%',
                  paddingVertical: 16,
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 16,
                    borderRadius: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#000', fontSize: 17, fontWeight: '700' }}>
                    {t('plans.upgradeToPremium')}
                  </Text>
                </LinearGradient>
              </Pressable>
              
              {/* Back Button */}
              <Pressable
                onPress={() => navigation.goBack()}
                style={{ marginTop: 16, paddingVertical: 8 }}
              >
                <Text style={{ color: colors.textMuted, fontSize: 15 }}>
                  {t('common.goBack')}
                </Text>
              </Pressable>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

