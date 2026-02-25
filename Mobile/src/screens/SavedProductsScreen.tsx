import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  RefreshControl, 
  Pressable,
  Dimensions,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getSavedProducts, FeedProduct, unsaveProduct } from '../api/products';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ProductBadges, ProductBadgeType } from '../components/ProductBadge';
import { fixImageUrlForEmulator } from '../utils/imageUrl';

const { width: screenWidth } = Dimensions.get('window');
const cardSize = (screenWidth - 72) / 4;

export const SavedProductsScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<FeedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const nav = useNavigation<any>();

  const load = async () => {
    try {
      setLoading(true);
      const data = await getSavedProducts(1, 100);
      setItems(data);
    } catch (e) {
      console.error('Error loading saved products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
      return () => {};
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const handleUnsave = async (id: string) => {
    try {
      await unsaveProduct(id);
      setItems(prev => prev.filter(p => p.id !== id));
    } catch (e) {}
  };

  const renderProductCard = ({ item }: { item: FeedProduct }) => (
    <Pressable
      onPress={() => nav.navigate('ProductDetail', { productId: item.id })}
      style={{
        width: cardSize,
        height: cardSize,
        marginRight: 8,
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        shadowColor: currentTheme === 'dark' ? '#000' : colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: currentTheme === 'dark' ? 0.3 : 0.1,
        shadowRadius: 4,
        elevation: 3,
        position: 'relative',
      }}
    >
      {item.firstPhotoUrl ? (
        <>
          <Image 
            source={{ uri: fixImageUrlForEmulator(item.firstPhotoUrl) }}
            style={{ width: '100%', height: '100%', borderRadius: 12 }}
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
          borderRadius: 12,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        </View>
      )}
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingVertical: 6,
          paddingHorizontal: 4,
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
        }}
      >
        <Text 
          style={{
            color: 'white',
            fontSize: 9,
            fontWeight: '600',
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </LinearGradient>

      <Pressable 
        onPress={(e) => {
          e.stopPropagation();
          handleUnsave(item.id);
        }}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          backgroundColor: 'rgba(0,0,0,0.6)',
          borderRadius: 12,
          padding: 4,
        }}
      >
        <Ionicons name="bookmark" size={14} color={colors.primary} />
      </Pressable>
    </Pressable>
  );

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
            onPress={() => nav.goBack()}
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
          
          <Text style={{ 
            color: colors.text, 
            fontSize: 20, 
            fontWeight: '700',
            flex: 1,
          }}>
            {t('profile.savedProducts')}
          </Text>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={4}
          contentContainerStyle={{ 
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: 100,
          }}
          columnWrapperStyle={{ 
            justifyContent: 'flex-start',
            marginBottom: 8,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={!loading ? (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🔖</Text>
              <Text style={{ 
                color: colors.textMuted, 
                fontSize: 18,
                fontWeight: '500',
                textAlign: 'center',
              }}>
                {t('profile.noSavedProducts')}
              </Text>
              <Text style={{ 
                color: colors.textMuted, 
                fontSize: 14,
                textAlign: 'center',
                marginTop: 8,
                paddingHorizontal: 40,
              }}>
                {t('profile.noSavedProductsDesc')}
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
          renderItem={renderProductCard}
        />
      </SafeAreaView>
    </View>
  );
};

