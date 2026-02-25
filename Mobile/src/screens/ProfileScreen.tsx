import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  RefreshControl, 
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
  TextInput
} from 'react-native';
import { Image } from 'expo-image';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { getUserProducts, UserProduct } from '../api/products';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchRoots, fetchChildren, Category } from '../api/categories';
import { CategorySelect } from '../components/CategorySelect';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../api/auth';
import i18n from '../i18n';
import { getFollowCounts, getPendingFollowRequests } from '../api/follows';
import { base64Decode } from '../api/auth';
import { ProductBadges, ProductBadgeType } from '../components/ProductBadge';
import { fixImageUrlForEmulator } from '../utils/imageUrl';
import { fetchUserPreferences } from '../api/userPreferences';
import { getMyPlan } from '../api/plan';

const { width: screenWidth } = Dimensions.get('window');
const gap = 2; // Instagram style gap between cards (2px between cards, 2 gaps total)
const cardSize = (screenWidth - (gap * 2)) / 3; // 3 columns: screenWidth - 2 gaps = cardSize * 3

export const ProfileScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { token, email } = useAuth();
  const { t } = useTranslation();
  const [allItems, setAllItems] = useState<UserProduct[]>([]);
  const [filteredItems, setFilteredItems] = useState<UserProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigation<any>();
  // Email artık AuthContext'ten geliyor
  const [scrollY] = useState(new Animated.Value(0));
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [childCategories, setChildCategories] = useState<Category[]>([]);
  const [selectedChildCategory, setSelectedChildCategory] = useState<string>('');
  const [selectedChildCategoryId, setSelectedChildCategoryId] = useState<string>('');
  const [grandChildCategories, setGrandChildCategories] = useState<Category[]>([]);
  const [selectedGrandChildCategory, setSelectedGrandChildCategory] = useState<string>('');
  const [selectedGrandChildCategoryId, setSelectedGrandChildCategoryId] = useState<string>('');
  const [allGrandChildrenOfParent, setAllGrandChildrenOfParent] = useState<string[]>([]);
  const [allGrandChildIdsFull, setAllGrandChildIdsFull] = useState<string[]>([]);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [pendingRequestCount, setPendingRequestCount] = useState<number>(0);
  const [userPlan, setUserPlan] = useState<'standard' | 'premium'>('standard');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarImageNonce, setAvatarImageNonce] = useState(0);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);

  const loadUserPlan = async () => {
    try {
      if (!token) return;
      const planDetails = await getMyPlan();
      setUserPlan(planDetails.isPremium ? 'premium' : 'standard');
    } catch (err) {
      console.error('Failed to load user plan:', err);
      setUserPlan('standard'); // Default to standard on error
    }
  };

  const loadUserPrefs = async () => {
    try {
      if (!token) return;
      const prefs = await fetchUserPreferences(token);
      if (prefs?.avatarUrl) setAvatarUrl(prefs.avatarUrl);
      else setAvatarUrl(null);
      setAvatarImageNonce(n => n + 1);
      setAvatarImageFailed(false);
      if (prefs?.username) setUsername(prefs.username);
    } catch (e) {
      // sessiz geç; profil ekranı çalışmaya devam etsin
    }
  };

  const getAvatarUri = (url: string | null) => {
    if (!url) return null;
    const fixed = fixImageUrlForEmulator(url);
    const join = fixed.includes('?') ? '&' : '?';
    return `${fixed}${join}v=${avatarImageNonce}`;
  };

  const openAvatarViewer = () => {
    // Kendi profilinde avatar'a tıklayınca Settings ekranına git (avatar değiştirme için)
    nav.navigate('Settings' as never);
  };

  const load = async () => {
    try {
      setLoading(true);
      if (!token) return;
      const data = await getUserProducts(token);
      setAllItems(data);
      setFilteredItems(data);
      await loadUserPrefs();
    } catch (e) {
      console.error('Error loading products:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      if (!token) return;
      
      // Backend'den optimize edilmiş endpoint kullan - sadece ürünü olan kategoriler
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
        setCategories(categoriesWithProducts);
      } else {
        // Fallback: Tüm kategorileri yükle
        const cats = await fetchRoots();
        setCategories(cats);
      }
    } catch (e) {
      // Hata durumunda tüm kategorileri göster
      try {
        const cats = await fetchRoots();
        setCategories(cats);
      } catch (e2) {
        console.error('Error loading categories:', e2);
      }
    }
  };

  useEffect(() => { 
    load(); 
    loadCategories();
    loadFollowCounts();
    // Email artık AuthContext'ten geliyor 
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadUserPrefs();
      loadUserPlan();
      loadFollowCounts();
    }, [token])
  );

  const loadFollowCounts = async () => {
    if (!token) return;
    try {
      // JWT'den user ID çıkar
      let decodedUserId: string | null = null;
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = parts[1];
          const decodedStr = base64Decode(payload);
          const decoded = JSON.parse(decodedStr);
          decodedUserId = decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || null;
        }
      } catch (e) {
        console.log('Could not decode JWT:', e);
      }
      
      if (decodedUserId) {
        const counts = await getFollowCounts(decodedUserId);
        setFollowerCount(counts.followerCount);
        setFollowingCount(counts.followingCount);
      }
    } catch (e) {
      console.error('Error loading follow counts:', e);
    }
  };

  // Kategorileri dil değiştiğinde yeniden yükle
  useEffect(() => {
    if (allItems.length > 0) {
      loadCategories();
    }
  }, [i18n.language, allItems.length]);

  // Ekran odağa geldiğinde listeyi her seferinde yenile
  useFocusEffect(
    React.useCallback(() => {
      load();
      return () => {};
    }, [token])
  );

  // Load children when parent category changes
  useEffect(() => {
    (async () => {
      try {
        setSelectedChildCategory('');
        setSelectedChildCategoryId('');
        setSelectedGrandChildCategory('');
        setSelectedGrandChildCategoryId('');
        setGrandChildCategories([]);
        setAllGrandChildrenOfParent([]);
        setAllGrandChildIdsFull([]);
        if (!selectedCategory || !token) {
          setChildCategories([]);
          return;
        }
        const parent = categories.find(c => c.name === selectedCategory);
        if (!parent) {
          setChildCategories([]);
          setAllGrandChildrenOfParent([]);
          setAllGrandChildIdsFull([]);
          return;
        }
        
        setSelectedCategoryId(parent.id);
        
        // Backend'den optimize edilmiş endpoint kullan - sadece ürünü olan alt kategoriler
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
          const flatGrandchildren = grandLists.flat() as Category[];
          const names = flatGrandchildren.map((g: Category) => g.name);
          const ids = flatGrandchildren.map((g: Category) => g.id);
          setAllGrandChildrenOfParent(names);
          setAllGrandChildIdsFull(ids);
        } catch (e) {
          console.error('Error loading all grandchildren:', e);
          setAllGrandChildrenOfParent([]);
          setAllGrandChildIdsFull([]);
        }
      } catch (e) {
        console.error('Error loading child categories:', e);
        setChildCategories([]);
        setAllGrandChildrenOfParent([]);
        setAllGrandChildIdsFull([]);
      }
    })();
  }, [selectedCategory, categories, token, i18n.language]);

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
        
        setSelectedChildCategoryId(child.id);
        
        // Backend'den optimize edilmiş endpoint kullan - sadece ürünü olan alt-alt kategoriler
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
          setGrandChildCategories(grandchildrenWithProducts);
        } else {
          // Fallback: Normal endpoint kullan
          const grandchildren = await fetchChildren(child.id);
          setGrandChildCategories(grandchildren);
        }
      } catch (e) {
        console.error('Error loading grandchild categories:', e);
        setGrandChildCategories([]);
      }
    })();
  }, [selectedChildCategory, childCategories, token, i18n.language]);

  // Filter logic
  useEffect(() => {
    let filtered = allItems;

    // Text search (hashtags)
    if (searchText.trim()) {
      filtered = filtered.filter(item => 
        item.hashtags?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.title?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Category filter: ID bazlı filtreleme (çeviri sorunlarından kaçınmak için)
    if (selectedGrandChildCategoryId) {
      filtered = filtered.filter(item => item.categoryId === selectedGrandChildCategoryId);
    } else if (selectedChildCategoryId) {
      const allowedIds = new Set<string>([
        selectedChildCategoryId,
        ...grandChildCategories.map(c => c.id),
      ]);
      filtered = filtered.filter(item => item.categoryId && allowedIds.has(item.categoryId));
    } else if (selectedCategoryId) {
      const allowedIds = new Set<string>([
        selectedCategoryId,
        ...childCategories.map(c => c.id),
        ...allGrandChildIdsFull,
      ]);
      filtered = filtered.filter(item => item.categoryId && allowedIds.has(item.categoryId));
    }

    setFilteredItems(filtered);
  }, [
    allItems,
    searchText,
    selectedCategoryId,
    selectedChildCategoryId,
    selectedGrandChildCategoryId,
    childCategories,
    grandChildCategories,
    allGrandChildIdsFull,
  ]);

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  // Tema uyumlu gradient renkler
  const getGradientColors = () => {
    if (currentTheme === 'dark') {
      return [colors.surface, colors.background, colors.border];
    } else {
      return [colors.primary + '40', colors.accent + '30', colors.surface];
    }
  };

  const renderProductCard = ({ item, index }: { item: UserProduct; index: number }) => {
    const isLastInRow = (index + 1) % 3 === 0;
    return (
    <Pressable
      onPress={() => {
        nav.navigate('ProductDetail', { productId: item.id });
      }}
      style={{
        width: cardSize,
        height: cardSize,
          marginRight: isLastInRow ? 0 : gap,
          marginBottom: gap,
        backgroundColor: colors.surface,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {item.firstPhotoUrl ? (
        <>
          <Image 
            source={{ uri: fixImageUrlForEmulator(item.firstPhotoUrl) }}
            style={{
              width: '100%',
              height: '100%',
            }}
            contentFit="cover"
            transition={200}
            placeholder={require('../../assets/adaptive-icon.png')}
          />
          {/* Badges */}
          {item.badges && item.badges.length > 0 && (
            <ProductBadges 
              badges={item.badges as ProductBadgeType[]}
              size="small"
              showText={false}
              position="top-right"
              maxBadges={2}
            />
          )}
        </>
      ) : (
        <View style={{
          width: '100%',
          height: '100%',
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        </View>
      )}
    </Pressable>
  );
  };

  const renderCategoryFilter = ({ item }: { item: Category }) => (
    <Pressable
      onPress={() => {
        const newCat = selectedCategory === item.name ? '' : item.name;
        setSelectedCategory(newCat);
        if (!newCat) {
          // Tüm kategori state'lerini temizle
          setSelectedCategoryId('');
          setSelectedChildCategory('');
          setSelectedChildCategoryId('');
          setSelectedGrandChildCategory('');
          setSelectedGrandChildCategoryId('');
        }
        // ID useEffect'te set edilecek
      }}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: selectedCategory === item.name ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selectedCategory === item.name ? colors.primary : colors.border,
        marginRight: 8,
      }}
    >
      <Text style={{
        color: selectedCategory === item.name ? colors.primaryTextOnPrimary : colors.text,
        fontSize: 14,
        fontWeight: '500',
      }}>
        {item.name}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <StatusBar 
        barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      
      {/* Tema uyumlu Gradient Background */}
      <LinearGradient
        colors={getGradientColors()}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
      />
      
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View 
          style={{ 
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 24,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            {/* Avatar + Email */}
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Pressable 
                onPress={openAvatarViewer}
                style={{ alignItems: 'center', marginRight: 12 }}
              >
                <View style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  padding: 2,
                }}>
                  <LinearGradient
                    colors={userPlan === 'premium'
                      ? ['#FFD700', '#FFA500']
                      : [colors.primary, colors.accent]}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      padding: 2,
                    }}
                  >
                    {avatarUrl && !avatarImageFailed ? (
                      <Image
                        key={getAvatarUri(avatarUrl) || avatarUrl}
                        source={{ uri: getAvatarUri(avatarUrl) || fixImageUrlForEmulator(avatarUrl) }}
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 23,
                        }}
                        contentFit="cover"
                        transition={200}
                        cachePolicy="disk"
                        onError={(e) => {
                          // Retry döngüsüne girmeyelim: sadece fallback'a geç
                          console.warn('[ProfileScreen] Avatar load error', e?.error);
                          setAvatarImageFailed(true);
                        }}
                      />
                    ) : (
                    <View style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                        <Ionicons name="person" size={24} color={colors.textMuted} />
                    </View>
                    )}
                  </LinearGradient>
                </View>
                {/* Plan Badge */}
                <View style={{
                  marginTop: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  backgroundColor: userPlan === 'premium'
                    ? (currentTheme === 'dark' ? '#FFD70020' : '#000000') // Light temada siyah, dark temada açık sarı
                    : colors.surface,
                  borderWidth: 1,
                  borderColor: userPlan === 'premium'
                    ? '#FFD700'
                    : colors.border,
                }}>
                  <Text style={{
                    color: userPlan === 'premium'
                      ? (currentTheme === 'dark' ? '#FFD700' : '#FFD700') // Light temada siyah background üzerine sarı, dark temada açık sarı background üzerine sarı
                      : colors.text,
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                  }}>
                    {userPlan === 'premium' ? (t('plans.premium') || 'Premium') : (t('plans.standard') || 'Standart')}
                  </Text>
                </View>
              </Pressable>
              
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: colors.text, 
                  fontSize: 16, 
                  fontWeight: '700',
                }} numberOfLines={1}>
                  {username ? `@${username}` : email}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Pressable 
                    onPress={() => {
                      // Get current user ID from token
                      (async () => {
                        try {
                          const parts = token.split('.');
                          if (parts.length === 3) {
                            const payload = parts[1];
                            const decodedStr = base64Decode(payload);
                            const decoded = JSON.parse(decodedStr);
                            const currentUserId = decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
                            if (currentUserId) {
                              nav.navigate('FollowList', { userId: currentUserId, type: 'followers' });
                            }
                          }
                        } catch (e) {
                          console.error('Error getting user ID:', e);
                        }
                      })();
                    }}
                    style={{ marginRight: 16 }}
                  >
                    <Text style={{ 
                      color: colors.textMuted, 
                      fontSize: 14,
                    }}>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{followerCount}</Text> {t('follow.followers')}
                    </Text>
                  </Pressable>
                  <Pressable 
                    onPress={() => {
                      // Get current user ID from token
                      (async () => {
                        try {
                          const parts = token.split('.');
                          if (parts.length === 3) {
                            const payload = parts[1];
                            const decodedStr = base64Decode(payload);
                            const decoded = JSON.parse(decodedStr);
                            const currentUserId = decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
                            if (currentUserId) {
                              nav.navigate('FollowList', { userId: currentUserId, type: 'following' });
                            }
                          }
                        } catch (e) {
                          console.error('Error getting user ID:', e);
                        }
                      })();
                    }}
                  >
                <Text style={{ 
                  color: colors.textMuted, 
                  fontSize: 14,
                }}>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{followingCount}</Text> {t('follow.following')}
                </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Follow Requests Badge (if any) */}
            {pendingRequestCount > 0 && (
              <Pressable
                onPress={() => {
                  // Takip taleplerine git
                  const decodedUserId = (() => {
                    try {
                      const parts = token.split('.');
                      if (parts.length === 3) {
                        const payload = parts[1];
                        const decodedStr = base64Decode(payload);
                        const decoded = JSON.parse(decodedStr);
                        return decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
                      }
                    } catch (e) {
                      return null;
                    }
                  })();
                  
                  if (decodedUserId) {
                    nav.navigate('FollowList', { userId: decodedUserId, type: 'pending' });
                  }
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.accent + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.accent,
                  marginRight: 8,
                }}
              >
                <Ionicons name="people" size={18} color={colors.accent} />
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: '#FF4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
                    {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Messages Button */}
            <Pressable
              onPress={() => nav.navigate('Inbox')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface + '90',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                marginRight: 8,
              }}
            >
              <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
            </Pressable>

            {/* Hamburger Menu */}
            <Pressable
              onPress={() => nav.navigate('Settings')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface + '90',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="menu" size={20} color={colors.text} />
            </Pressable>
          </View>

        </Animated.View>

        {/* Products Grid with Filters */}
        <View style={{ 
          flex: 1, 
          backgroundColor: colors.background,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingTop: 20,
          marginTop: -16,
          paddingHorizontal: 0,
        }}>
          {/* Filter Bar */}
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            {/* Search + Count */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ 
                flex: 1, 
                flexDirection: 'row', 
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder={t('categories.search')}
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 8,
                    color: colors.text,
                    fontSize: 14,
                  }}
                />
              </View>
              
              {/* Product Count */}
              <View style={{
                backgroundColor: colors.primary + '20',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                marginLeft: 12,
                minWidth: 60,
                alignItems: 'center',
              }}>
                <Text style={{ 
                  color: colors.primary, 
                  fontSize: 14, 
                  fontWeight: '700',
                }}>
                  {filteredItems.length}
                </Text>
                <Text style={{ 
                  color: colors.primary, 
                  fontSize: 10,
                }}>
                  {t('profile.myProducts')}
                </Text>
              </View>

              {/* Collection Report Button */}
              <Pressable
                onPress={() => nav.navigate('CollectionReport')}
                style={({ pressed }) => ({
                  backgroundColor: colors.surface,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 12,
                  marginLeft: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                  minWidth: 60,
                })}
              >
                <Text style={{ 
                  color: colors.primary, 
                  fontSize: 10,
                  fontWeight: '600',
                  textAlign: 'center',
                  lineHeight: 12,
                }}>
                  {t('collectionReport.shortTitle') || 'Collection'}
                </Text>
                <Text style={{ 
                  color: colors.primary, 
                  fontSize: 10,
                  fontWeight: '600',
                  textAlign: 'center',
                  lineHeight: 12,
                }}>
                  {t('collectionReport.shortSubtitle') || 'Report'}
                </Text>
              </Pressable>
            </View>

            {/* Category Select (Parent + optional child) */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                  // ID'ler useEffect'te set edilecek
                }}
                placeholder="Kategori seç"
              />
              {childCategories.length > 0 && (
                <View style={{ marginLeft: 8 }}>
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
                    // ID useEffect'te set edilecek
                  }}
                    placeholder="Alt kategori"
                  />
                </View>
              )}
            {grandChildCategories.length > 0 && (
              <View style={{ marginLeft: 8 }}>
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
                  placeholder="Alt kategori 2"
                />
              </View>
            )}
            </View>
          </View>

          <AnimatedFlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={{ 
              paddingBottom: 100,
              paddingHorizontal: 0,
            }}
            columnWrapperStyle={{ 
              justifyContent: 'flex-start',
              paddingHorizontal: 0,
              marginHorizontal: 0,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl 
                refreshing={loading} 
                onRefresh={load} 
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            ListEmptyComponent={!loading ? (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>
                  {searchText || selectedCategory ? '🔍' : '📦'}
                </Text>
                <Text style={{ 
                  color: colors.textMuted, 
                  fontSize: 18,
                  fontWeight: '500',
                  textAlign: 'center',
                }}>
                  {searchText || selectedCategory ? t('profile.noProducts') : t('profile.noProducts')}
                </Text>
                <Text style={{ 
                  color: colors.textMuted, 
                  fontSize: 14,
                  textAlign: 'center',
                  marginTop: 8,
                  paddingHorizontal: 40,
                }}>
                  {searchText || selectedCategory ? t('home.loading') : t('profile.noProductsDesc')}
                </Text>
              </View>
            ) : null}
            renderItem={renderProductCard}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};