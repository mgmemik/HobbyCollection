import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  RefreshControl, 
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
  TextInput,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { Image } from 'expo-image';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { searchProducts, FeedProduct } from '../api/products';
import { searchUsers, SearchUser } from '../api/auth';
import { useNavigation } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchRoots, fetchChildren, Category } from '../api/categories';
import { CategorySelect } from '../components/CategorySelect';
import { useTranslation } from 'react-i18next';
import { ProductBadges, ProductBadgeType } from '../components/ProductBadge';
import { fixImageUrlForEmulator } from '../utils/imageUrl';

const { width: screenWidth } = Dimensions.get('window');
const gap = 2; // Instagram style gap between cards (2px between cards, 2 gaps total = 4px)
const cardSize = (screenWidth - (gap * 2)) / 3; // 3 columns: screenWidth - 4px (2 gaps) = cardSize * 3

type SearchTab = 'products' | 'users';

export const SearchScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t } = useTranslation();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const [scrollY] = useState(new Animated.Value(0));
  
  // Tab state
  const [activeTab, setActiveTab] = useState<SearchTab>('products');
  
  // Products search states
  const [allItems, setAllItems] = useState<FeedProduct[]>([]);
  const [productsPage, setProductsPage] = useState(1);
  const [productsHasMore, setProductsHasMore] = useState(true);
  
  // Users search states
  const [allUsers, setAllUsers] = useState<SearchUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersHasMore, setUsersHasMore] = useState(true);
  
  const [loading, setLoading] = useState(false);
  
  // Filter states (only for products)
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [childCategories, setChildCategories] = useState<Category[]>([]);
  const [selectedChildCategory, setSelectedChildCategory] = useState<string>('');
  const [grandChildCategories, setGrandChildCategories] = useState<Category[]>([]);
  const [selectedGrandChildCategory, setSelectedGrandChildCategory] = useState<string>('');

  // Dışarıdan (akış/detay) keyword ile gelme: Search ekranını otomatik doldur + ara
  useEffect(() => {
    const initialQueryRaw = route?.params?.initialQuery;
    if (typeof initialQueryRaw !== 'string') return;
    const initialQuery = initialQueryRaw.trim();
    if (!initialQuery) return;

    // Ürün aramasına yönlendir (keyword çoğunlukla ürün için)
    setActiveTab('products');
    setSearchText(initialQuery);

    // Kategori filtrelerini temizle (keyword araması için daha doğal)
    setSelectedCategory('');
    setSelectedChildCategory('');
    setSelectedGrandChildCategory('');

    // Paramı temizle ki geri gelip tekrar tetiklemesin
    try {
      nav.setParams({ initialQuery: undefined });
    } catch {}
  }, [route?.params?.initialQuery]);

  // Dışarıdan (ürün detay) kategori ile gelme: Kategori filtresini uygula
  useEffect(() => {
    const initialCategoryId = route?.params?.initialCategoryId as string | undefined;
    const initialCategoryName = route?.params?.initialCategoryName as string | undefined;
    
    if (!initialCategoryId || !initialCategoryName) return;

    // Ürün aramasına yönlendir
    setActiveTab('products');
    
    // Kategoriyi seç
    setSelectedCategory(initialCategoryName);
    
    // Kategori ID'sini bul ve filtreyi uygula
    const category = categories.find(c => c.id === initialCategoryId);
    if (category) {
      setSelectedCategory(initialCategoryName);
      // Alt kategorileri yükle
      loadCategories().then(() => {
        fetchChildren(category.id).then(children => {
          setChildCategories(children);
        });
      });
    }

    // Paramı temizle ki geri gelip tekrar tetiklemesin
    try {
      nav.setParams({ initialCategoryId: undefined, initialCategoryName: undefined });
    } catch {}
  }, [route?.params?.initialCategoryId, route?.params?.initialCategoryName, categories]);

  const loadCategories = async () => {
    try {
      const cats = await fetchRoots();
      setCategories(cats);
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Load children when parent category changes
  useEffect(() => {
    (async () => {
      try {
        setSelectedChildCategory('');
        setSelectedGrandChildCategory('');
        setGrandChildCategories([]);
        if (!selectedCategory) {
          setChildCategories([]);
          return;
        }
        const parent = categories.find(c => c.name === selectedCategory);
        if (!parent) {
          setChildCategories([]);
          return;
        }
        const children = await fetchChildren(parent.id);
        setChildCategories(children);
      } catch {
        setChildCategories([]);
      }
    })();
  }, [selectedCategory, categories]);

  // Load grandchildren when child category changes
  useEffect(() => {
    (async () => {
      try {
        setSelectedGrandChildCategory('');
        if (!selectedChildCategory) {
          setGrandChildCategories([]);
          return;
        }
        const child = childCategories.find(c => c.name === selectedChildCategory);
        if (!child) {
          setGrandChildCategories([]);
          return;
        }
        const grandchildren = await fetchChildren(child.id);
        setGrandChildCategories(grandchildren);
      } catch {
        setGrandChildCategories([]);
      }
    })();
  }, [selectedChildCategory, childCategories]);

  // Perform products search
  const performProductsSearch = useCallback(async (pageNum: number = 1, isNewSearch: boolean = false) => {
    if (activeTab !== 'products') return;
    
    try {
      if (pageNum === 1) {
        if (!isNewSearch) {
          setLoading(true);
        }
      } else {
        setLoading(true);
      }

      // Determine which category ID to use (prefer most specific)
      let categoryId: string | undefined = undefined;
      if (selectedGrandChildCategory) {
        const grandChild = grandChildCategories.find(c => c.name === selectedGrandChildCategory);
        categoryId = grandChild?.id;
      } else if (selectedChildCategory) {
        const child = childCategories.find(c => c.name === selectedChildCategory);
        categoryId = child?.id;
      } else if (selectedCategory) {
        const parent = categories.find(c => c.name === selectedCategory);
        categoryId = parent?.id;
      }

      const data = await searchProducts(
        searchText || undefined,
        categoryId,
        pageNum,
        20
      );

      if (pageNum === 1) {
        setAllItems(data);
      } else {
        setAllItems(prev => [...prev, ...data]);
      }

      setProductsHasMore(data.length === 20);
      setProductsPage(pageNum);
    } catch (e) {
      console.error('Products search error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchText, selectedCategory, selectedChildCategory, selectedGrandChildCategory, categories, childCategories, grandChildCategories]);

  // Perform users search
  const performUsersSearch = useCallback(async (pageNum: number = 1, isNewSearch: boolean = false) => {
    if (activeTab !== 'users') return;
    
    try {
      if (pageNum === 1) {
        if (!isNewSearch) {
          setLoading(true);
        }
      } else {
        setLoading(true);
      }

      const response = await searchUsers(
        searchText || undefined,
        pageNum,
        20
      );

      if (pageNum === 1) {
        setAllUsers(response.users);
      } else {
        setAllUsers(prev => [...prev, ...response.users]);
      }

      setUsersHasMore(response.hasMore);
      setUsersPage(pageNum);
    } catch (e) {
      console.error('Users search error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchText]);

  // Perform search when filters change
  useEffect(() => {
    if (activeTab === 'products') {
      performProductsSearch(1, true);
    } else if (activeTab === 'users') {
      performUsersSearch(1, true);
    }
  }, [activeTab, searchText, selectedCategory, selectedChildCategory, selectedGrandChildCategory, performProductsSearch, performUsersSearch]);

  // Reset when tab changes
  useEffect(() => {
    if (activeTab === 'products') {
      setAllUsers([]);
      setUsersPage(1);
      setUsersHasMore(true);
    } else {
      setAllItems([]);
      setProductsPage(1);
      setProductsHasMore(true);
    }
  }, [activeTab]);

  const handleLoadMore = () => {
    if (loading) return;
    
    if (activeTab === 'products' && productsHasMore) {
      performProductsSearch(productsPage + 1);
    } else if (activeTab === 'users' && usersHasMore) {
      performUsersSearch(usersPage + 1);
    }
  };

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

  const renderProductCard = ({ item, index }: { item: FeedProduct; index: number }) => {
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

  const renderUserCard = ({ item }: { item: SearchUser }) => {
    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    };

    return (
      <Pressable
        onPress={() => {
          nav.navigate('UserProfile', { userId: item.userId });
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          backgroundColor: colors.surface,
          marginHorizontal: 24,
          marginBottom: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {/* Avatar */}
        {item.avatarUrl ? (
          <Image
            source={{ uri: fixImageUrlForEmulator(item.avatarUrl) }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              marginRight: 12,
              backgroundColor: colors.border,
            }}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
            onError={(e) => console.warn('[SearchScreen] User avatar load error', e?.error)}
          />
        ) : (
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
          }}>
            <Text style={{
              fontSize: 20,
              fontWeight: '700',
              color: colors.primary,
            }}>
              {getInitials(item.displayName)}
            </Text>
          </View>
        )}

        {/* User Info */}
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
          }}>
            {item.displayName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{
              fontSize: 13,
              color: colors.textMuted,
              marginRight: 12,
            }}>
              {item.productCount} {item.productCount === 1 ? 'ürün' : 'ürün'}
            </Text>
            <Text style={{
              fontSize: 13,
              color: colors.textMuted,
              marginRight: 12,
            }}>
              {item.followerCount} {t('search.followers')}
            </Text>
            <Text style={{
              fontSize: 13,
              color: colors.textMuted,
            }}>
              {item.followingCount} {t('search.following')}
            </Text>
          </View>
        </View>

        {/* Follow Indicator */}
        {item.isFollowing && (
          <View style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: colors.primary + '20',
          }}>
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: colors.primary,
            }}>
              {t('follow.following')}
            </Text>
          </View>
        )}

        {/* Private Account Indicator */}
        {item.isPrivateAccount && (
          <Ionicons 
            name="lock-closed" 
            size={16} 
            color={colors.textMuted} 
            style={{ marginLeft: 8 }}
          />
        )}

        {/* Arrow */}
        <Ionicons 
          name="chevron-forward" 
          size={20} 
          color={colors.textMuted} 
          style={{ marginLeft: 8 }}
        />
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (!loading || (activeTab === 'products' ? productsPage === 1 : usersPage === 1)) return null;
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  const renderEmptyComponent = () => {
    if (loading) return null;
    
    if (activeTab === 'products') {
      return (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>
            {searchText || selectedCategory ? '🔍' : '🌍'}
          </Text>
          <Text style={{ 
            color: colors.textMuted, 
            fontSize: 18,
            fontWeight: '500',
            textAlign: 'center',
          }}>
            {searchText || selectedCategory ? t('search.noResults') : t('search.startSearching')}
          </Text>
          <Text style={{ 
            color: colors.textMuted, 
            fontSize: 14,
            textAlign: 'center',
            marginTop: 8,
            paddingHorizontal: 40,
          }}>
            {searchText || selectedCategory 
              ? t('search.tryDifferentSearch')
              : t('search.discoverProducts')}
          </Text>
        </View>
      );
    } else {
      return (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>
            {searchText ? '🔍' : '👥'}
          </Text>
          <Text style={{ 
            color: colors.textMuted, 
            fontSize: 18,
            fontWeight: '500',
            textAlign: 'center',
          }}>
            {searchText ? t('search.noUsersFound') : t('search.startSearching')}
          </Text>
          <Text style={{ 
            color: colors.textMuted, 
            fontSize: 14,
            textAlign: 'center',
            marginTop: 8,
            paddingHorizontal: 40,
          }}>
            {searchText 
              ? t('search.tryDifferentSearch')
              : t('search.discoverUsers')}
          </Text>
        </View>
      );
    }
  };

  const currentItemCount = activeTab === 'products' ? allItems.length : allUsers.length;
  const currentHasMore = activeTab === 'products' ? productsHasMore : usersHasMore;

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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 12,
            }}>
              <LinearGradient
                colors={[colors.primary, colors.accent]}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="search" size={20} color="white" />
              </LinearGradient>
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ 
                color: colors.text, 
                fontSize: 24, 
                fontWeight: '700',
              }}>
                {t('search.title')}
              </Text>
              <Text style={{ 
                color: colors.textMuted, 
                fontSize: 14,
              }}>
                {t('search.subtitle')}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Search Results with Tabs */}
        <View style={{ 
          flex: 1, 
          backgroundColor: colors.background,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingTop: 20,
          marginTop: -16,
          paddingHorizontal: 0,
        }}>
          {/* Search Bar */}
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
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
                  placeholder={activeTab === 'products' ? t('search.placeholder') : t('search.placeholderUsers')}
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    color: colors.text,
                    fontSize: 14,
                  }}
                />
              </View>
              
              {/* Result Count */}
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
                  {currentItemCount}
                </Text>
                <Text style={{ 
                  color: colors.primary, 
                  fontSize: 10,
                }}>
                  {t('search.result')}
                </Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 4,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <TouchableOpacity
                onPress={() => setActiveTab('products')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: activeTab === 'products' ? colors.primary : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: activeTab === 'products' ? 'white' : colors.text,
                }}>
                  {t('search.tabProducts')}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => setActiveTab('users')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: activeTab === 'users' ? colors.primary : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: activeTab === 'users' ? 'white' : colors.text,
                }}>
                  {t('search.tabUsers')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Category Select (only for products) */}
            {activeTab === 'products' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <CategorySelect
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelect={(cat) => {
                    setSelectedCategory(cat);
                    setSelectedChildCategory('');
                    setSelectedGrandChildCategory('');
                  }}
                  placeholder={t('search.selectCategory')}
                />
                {childCategories.length > 0 && (
                  <View style={{ marginLeft: 8 }}>
                    <CategorySelect
                      categories={childCategories}
                      selectedCategory={selectedChildCategory}
                      onSelect={(cat) => { 
                        setSelectedChildCategory(cat); 
                        setSelectedGrandChildCategory(''); 
                      }}
                      placeholder={t('search.subCategory')}
                    />
                  </View>
                )}
                {grandChildCategories.length > 0 && (
                  <View style={{ marginLeft: 8 }}>
                    <CategorySelect
                      categories={grandChildCategories}
                      selectedCategory={selectedGrandChildCategory}
                      onSelect={setSelectedGrandChildCategory}
                      placeholder={t('search.subCategory2')}
                    />
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Results List */}
          {activeTab === 'products' ? (
            <AnimatedFlatList
              key="products-list"
              data={allItems}
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
                  refreshing={loading && productsPage === 1} 
                  onRefresh={() => performProductsSearch(1)} 
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true }
              )}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={10}
              ListFooterComponent={renderFooter}
              ListEmptyComponent={renderEmptyComponent}
              renderItem={renderProductCard}
            />
          ) : (
            <AnimatedFlatList
              key="users-list"
              data={allUsers}
              keyExtractor={(item) => item.userId}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl 
                  refreshing={loading && usersPage === 1} 
                  onRefresh={() => performUsersSearch(1)} 
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true }
              )}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
              ListEmptyComponent={renderEmptyComponent}
              renderItem={renderUserCard}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};
