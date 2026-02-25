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
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getUserPublicProducts, UserPublicProfile, UserProduct } from '../api/products';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { followUser, unfollowUser, getFollowCounts, checkFollow } from '../api/follows';
import { useToast } from '../components/ui/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { base64Decode } from '../api/auth';
import { getOrCreateConversation } from '../api/conversations';
import { ReportModal } from '../components/ReportModal';
import { ProductBadges, ProductBadgeType } from '../components/ProductBadge';
import { fixImageUrlForEmulator } from '../utils/imageUrl';
import { AvatarViewerModal } from '../components/AvatarViewerModal';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const { width: screenWidth } = Dimensions.get('window');
// Kendi profil ekranı ile aynı grid: 3 kolon + minimal gap
const gap = 2;
const cardSize = (screenWidth - (gap * 2)) / 3;

export const UserProfileScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const { token } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { userId } = route.params as { userId: string };

  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followStatus, setFollowStatus] = useState<string>('none'); // 'none', 'pending', 'accepted'
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
  const [isPrivateAccount, setIsPrivateAccount] = useState<boolean>(false);
  const [canViewProducts, setCanViewProducts] = useState<boolean>(true);
  const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await getUserPublicProducts(userId);
      setProfile(data);
      
      // JWT'den user ID çıkar (token varsa)
      let decodedUserId: string | null = null;
      if (token) {
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
      }
      
      // isOwnProfile: token varsa ve decodedUserId === userId ise true, yoksa false
      const isOwn = token ? (decodedUserId === userId) : false;
      setIsOwnProfile(isOwn);
      console.log('[UserProfileScreen] isOwnProfile:', isOwn, 'decodedUserId:', decodedUserId, 'userId:', userId, 'token:', !!token);
      
      // Takip durumunu ve sayıları yükle
      if (token) {
        try {
          const counts = await getFollowCounts(userId);
          setIsFollowing(counts.isFollowing || false);
          setFollowStatus(counts.status || 'none');
          setIsPrivateAccount(counts.isPrivateAccount || false);
          setFollowerCount(counts.followerCount);
          setFollowingCount(counts.followingCount);
          
          if (!isOwn) {
            // Kapalı hesap kontrolü
            if (counts.isPrivateAccount && !counts.isFollowing) {
              setCanViewProducts(false);
            } else {
              setCanViewProducts(true);
            }
          } else {
            setCanViewProducts(true);
          }
        } catch (e) {
          console.error('Error loading follow data:', e);
        }
      }
      
      // Backend'den gelen sayıları da kullan
      if (data.followerCount !== undefined) setFollowerCount(data.followerCount);
      if (data.followingCount !== undefined) setFollowingCount(data.followingCount);
      if (data.isFollowing !== undefined) setIsFollowing(data.isFollowing);
      if (data.isPrivateAccount !== undefined) setIsPrivateAccount(data.isPrivateAccount);
      if (data.canViewProducts !== undefined) setCanViewProducts(data.canViewProducts);
    } catch (e) {
      console.error('Error loading user profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    try {
      // followStatus === 'accepted' veya isFollowing === true ise unfollow yap
      if (followStatus === 'accepted' || isFollowing) {
        const result = await unfollowUser(userId);
        setIsFollowing(false);
        setFollowStatus('none');
        setFollowerCount(prev => Math.max(0, prev - 1));
        // Kapalı hesap ise ürünleri görememeli
        if (isPrivateAccount) {
          setCanViewProducts(false);
        }
        toast.show({ type: 'success', message: t('follow.unfollowed') });
      } else {
        const result = await followUser(userId);
        // Backend'den gelen status'a göre güncelle
        if (result.status === 'pending') {
          setFollowStatus('pending');
          setIsFollowing(false);
          toast.show({ type: 'success', message: t('follow.requestSent') });
        } else {
          setIsFollowing(true);
          setFollowStatus('accepted');
          setFollowerCount(prev => prev + 1);
          setCanViewProducts(true);
          toast.show({ type: 'success', message: t('follow.followed') });
        }
      }
    } catch (e: any) {
      console.error('Follow/Unfollow error:', e);
      toast.show({ type: 'error', message: t('follow.error'), subMessage: e?.message });
    }
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const renderProductCard = ({ item, index }: { item: UserProduct; index: number }) => {
    const isLastInRow = (index + 1) % 3 === 0;
    return (
    <Pressable
      onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
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
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  const renderEmpty = () => (
    <View style={{ 
      alignItems: 'center', 
      justifyContent: 'center',
      paddingVertical: 60,
    }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>📦</Text>
      <Text style={{ 
        color: colors.textMuted, 
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
      }}>
        {t('profile.noProducts')}
      </Text>
      <Text style={{ 
        color: colors.textMuted, 
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 40,
      }}>
        {t('profile.noProductsDesc')}
      </Text>
    </View>
  );

  if (loading && !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar 
          barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor={colors.surface}
        />
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </SafeAreaView>
      </View>
    );
  }

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
            {/* Back button + User Info */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable
                  onPress={() => navigation.goBack()}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.surface + '90',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color={colors.text} />
                </Pressable>
                
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 16, 
                    fontWeight: '700',
                  }} numberOfLines={1}>
                    {profile?.displayName || t('profile.user')}
                  </Text>
                </View>
              </View>
              
              {/* Follower/Following Counts */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 52 }}>
                <Pressable 
                  onPress={() => {
                    navigation.navigate('FollowList', { userId, type: 'followers' });
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
                    navigation.navigate('FollowList', { userId, type: 'following' });
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
              
              {/* Follow/Unfollow and Message Buttons */}
              {!isOwnProfile && !!token && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginLeft: 52 }}>
                  <Pressable
                    onPress={handleFollow}
                    disabled={loading}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: (followStatus === 'accepted' || isFollowing) ? colors.surface : colors.primary,
                      borderWidth: 1,
                      borderColor: (followStatus === 'accepted' || isFollowing) ? colors.border : colors.primary,
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <Text style={{
                      color: (followStatus === 'accepted' || isFollowing) ? colors.text : 'white',
                      fontSize: 14,
                      fontWeight: '600',
                    }}>
                      {(followStatus === 'accepted' || isFollowing)
                        ? t('follow.unfollow') 
                        : followStatus === 'pending'
                        ? t('follow.requestPending')
                        : t('follow.follow')}
                    </Text>
                  </Pressable>
                  
                  <Pressable
                    onPress={async () => {
                      try {
                        const conversation = await getOrCreateConversation(userId);
                        navigation.navigate('Chat', {
                          conversationId: conversation.id,
                          otherUserId: userId,
                          otherUserDisplayName: profile?.displayName || 'User',
                        });
                      } catch (error: any) {
                        console.error('Error creating conversation:', error);
                        toast.show({
                          type: 'error',
                          message: error?.message || t('messages.error') || 'Konuşma oluşturulamadı',
                          subMessage: 'Lütfen tekrar deneyin',
                        });
                      }
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
                  </Pressable>
                  
                  {/* Report button */}
                  <Pressable
                    onPress={() => setReportModalOpen(true)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Ionicons name="flag-outline" size={20} color={colors.text} />
                  </Pressable>
                </View>
              )}
            </View>
            
            {/* Report Modal */}
            <ReportModal
              visible={reportModalOpen}
              onClose={() => setReportModalOpen(false)}
              contentType="user"
              contentId={userId}
              contentTitle={profile?.displayName || undefined}
            />

            {/* Avatar */}
            <Pressable
              onPress={() => setAvatarViewerOpen(true)}
              disabled={!profile?.avatarUrl}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                padding: 2,
              }}
            >
              <LinearGradient
                colors={[colors.primary, colors.accent]}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  padding: 2,
                }}
              >
                {profile?.avatarUrl ? (
                  <Image
                    source={{ uri: fixImageUrlForEmulator(profile.avatarUrl) }}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                    }}
                    contentFit="cover"
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
            </Pressable>
          </View>
        </Animated.View>

        <AvatarViewerModal
          visible={avatarViewerOpen}
          uri={profile?.avatarUrl ? fixImageUrlForEmulator(profile.avatarUrl) : null}
          onClose={() => setAvatarViewerOpen(false)}
        />

        {/* Products Grid */}
        <View style={{ 
          flex: 1, 
          backgroundColor: colors.background,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingTop: 20,
          marginTop: -16,
        }}>
          {!canViewProducts && isPrivateAccount && !isOwnProfile ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
              <Ionicons name="lock-closed" size={64} color={colors.textMuted} style={{ marginBottom: 16 }} />
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
                {t('follow.privateAccount')}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, textAlign: 'center' }}>
                {t('follow.privateAccountMessage')}
              </Text>
            </View>
          ) : (
          <AnimatedFlatList
            data={profile?.products || []}
            keyExtractor={(item) => item.id}
            numColumns={3}
            key="grid-3"
            contentContainerStyle={{ 
              paddingHorizontal: 0,
              paddingBottom: 100,
            }}
            columnWrapperStyle={{ 
              justifyContent: 'flex-start',
              paddingHorizontal: 0,
              marginHorizontal: 0,
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
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            ListEmptyComponent={!loading ? renderEmpty : null}
            renderItem={renderProductCard}
          />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

