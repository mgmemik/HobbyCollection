import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  RefreshControl, 
  Pressable,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Modal,
  Platform,
  TextInput,
  Alert,
  Keyboard,
  Share
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getFeedProducts, FeedProduct, likeProduct, unlikeProduct, getProductLikers, ProductLiker, saveProduct, unsaveProduct, getComments, createComment, deleteComment, likeComment, unlikeComment, Comment, getUnreadNotificationCount } from '../api/products';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '../components/Logo';
import { useTranslation } from 'react-i18next';
import { followUser, unfollowUser, checkFollow } from '../api/follows';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { base64Decode } from '../api/auth';
import { AICreditIndicator } from '../components/AICreditIndicator';
import { ProductBadges, ProductBadgeType } from '../components/ProductBadge';
import { fixImageUrlForEmulator } from '../utils/imageUrl';
import { PinchZoomImage } from '../components/PinchZoomImage';

const { width: screenWidth } = Dimensions.get('window');

export const HomeScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const { token } = useAuth();
  const [items, setItems] = useState<FeedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const nav = useNavigation<any>();
  const [likersOpen, setLikersOpen] = useState(false);
  const [likers, setLikers] = useState<ProductLiker[]>([]);
  const [likersTitle, setLikersTitle] = useState<string>('');
  const [photoIndices, setPhotoIndices] = useState<Record<string, number>>({});
  const [isPinchingPhoto, setIsPinchingPhoto] = useState<Record<string, boolean>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [sendingComment, setSendingComment] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(Dimensions.get('window').height);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);

  const loadFeed = async (pageNum: number = 1, isRefresh: boolean = false) => {
    try {
      if (pageNum === 1) {
        setRefreshing(isRefresh);
        setLoading(false);
      } else {
        setLoading(true);
      }
      
      const data = await getFeedProducts(pageNum, 20, token || undefined);
      
      if (pageNum === 1) {
        setItems(data);
      } else {
        setItems(prev => [...prev, ...data]);
      }
      
      setHasMore(data.length === 20);
      setPage(pageNum);
      
      // Takip durumlarını yükle (sadece ilk sayfa için)
      if (token && pageNum === 1) {
        try {
          // Mevcut kullanıcı ID'sini al
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = parts[1];
            const decodedStr = base64Decode(payload);
            const decoded = JSON.parse(decodedStr);
            const userId = decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || null;
            setCurrentUserId(userId);
            
            // Her kullanıcı için takip durumunu kontrol et
            const uniqueUserIds = [...new Set(data.map(item => item.userId).filter(Boolean))];
            const followChecks = await Promise.all(
              uniqueUserIds.map(async (userId) => {
                try {
                  const check = await checkFollow(userId);
                  return { userId, isFollowing: check.isFollowing };
                } catch {
                  return { userId, isFollowing: false };
                }
              })
            );
            const map: Record<string, boolean> = {};
            followChecks.forEach(({ userId, isFollowing }) => {
              map[userId] = isFollowing;
            });
            setFollowingMap(map);
          }
        } catch (e) {
          console.error('Error loading follow statuses:', e);
        }
      }
    } catch (e) {
      console.error('Feed loading error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFollowToggle = async (targetUserId: string, currentState: boolean) => {
    if (!token) return;
    
    try {
      if (currentState) {
        await unfollowUser(targetUserId);
        setFollowingMap(prev => ({ ...prev, [targetUserId]: false }));
        toast.show({ type: 'success', message: t('follow.unfollowed') });
      } else {
        await followUser(targetUserId);
        setFollowingMap(prev => ({ ...prev, [targetUserId]: true }));
        toast.show({ type: 'success', message: t('follow.followed') });
      }
    } catch (e: any) {
      toast.show({ type: 'error', message: t('follow.error'), subMessage: e?.message });
    }
  };

  useEffect(() => {
    loadFeed(1);
  }, []);

  const loadUnreadNotificationCount = async () => {
    if (!token) return;
    try {
      const response = await getUnreadNotificationCount();
      setUnreadNotificationCount(response.count || 0);
    } catch (error) {
      // Hata durumunda sessizce devam et
      console.error('Failed to load unread notification count:', error);
    }
  };

  // Ekran odağa geldiğinde feed'i yenile ve okunmamış bildirim sayısını güncelle
  useFocusEffect(
    React.useCallback(() => {
      loadFeed(1, true);
      loadUnreadNotificationCount();
      return () => {};
    }, [token])
  );

  // Klavye durumunu ve yüksekliğini takip et (iOS ve Android için)
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Android için ekran yüksekliği değişimini takip et (klavye açıldığında window height azalır)
  useEffect(() => {
    if (Platform.OS === 'android') {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        const newHeight = window.height;
        if (newHeight < windowHeight && isKeyboardVisible) {
          // Ekran yüksekliği azaldıysa klavye açılmış demektir
          const calculatedKeyboardHeight = windowHeight - newHeight;
          if (calculatedKeyboardHeight > 0) {
            setKeyboardHeight(calculatedKeyboardHeight);
          }
        } else if (newHeight >= windowHeight) {
          // Ekran yüksekliği normale döndüyse klavye kapanmış demektir
          setKeyboardHeight(0);
          setIsKeyboardVisible(false);
        }
        setWindowHeight(newHeight);
      });

      return () => subscription?.remove();
    }
  }, [windowHeight, isKeyboardVisible]);

  const handleRefresh = () => {
    loadFeed(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadFeed(page + 1);
    }
  };

  const toggleLike = async (id: string) => {
    // Mevcut state'i sakla (optimistic update için)
    const target = items.find(p => p.id === id);
    if (!target) return;
    
    const currentLiked = target.isLiked ?? false;
    const currentCount = target.likeCount || 0;
    
    // Optimistic update
    setItems(prev => prev.map(p => p.id === id ? {
      ...p,
      isLiked: !currentLiked,
      likeCount: currentCount + (currentLiked ? -1 : 1)
    } : p));

    try {
      if (currentLiked) {
        await unlikeProduct(id);
      } else {
        await likeProduct(id);
      }
    } catch (e) {
      // Hata durumunda geri al
      setItems(prev => prev.map(p => p.id === id ? {
        ...p,
        isLiked: currentLiked,
        likeCount: currentCount
      } : p));
      toast.show({ type: 'error', message: t('productDetail.error') || 'Bir hata oluştu' });
    }
  };

  const openLikers = async (item: FeedProduct) => {
    try {
      setLikersTitle(item.title);
      const res = await getProductLikers(item.id, 1, 50);
      setLikers(res.items);
      setLikersOpen(true);
    } catch (e) {
      console.error('Likers error', e);
    }
  };

  const toggleSave = async (id: string) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, isSaved: !p.isSaved } : p));
    try {
      const target = items.find(p => p.id === id);
      if (target?.isSaved) await unsaveProduct(id);
      else await saveProduct(id);
    } catch (e) {
      setItems(prev => prev.map(p => p.id === id ? { ...p, isSaved: !p.isSaved } : p));
    }
  };

  const shareProduct = async (item: FeedProduct) => {
    try {
      const title = item.title || 'Ürün';
      const desc = item.description ? `\n\n${item.description}` : '';
      const hashtags = item.hashtags ? `\n\n${item.hashtags}` : '';
      const message = `${title}${desc}${hashtags}`.trim();

      // Paylaşım için mümkünse ilk foto URL'ini ekle (prod'da GCS; dev'da yine de çalışır)
      const firstPhotoUrl =
        item.photos?.[0]?.blobUrl ||
        item.firstPhotoUrl ||
        undefined;

      await Share.share({
        message,
        url: firstPhotoUrl,
      });
    } catch (e: any) {
      toast.show({ type: 'error', message: e?.message || (t('common.error') || 'Hata') });
    }
  };

  const loadCommentsForProduct = async (productId: string) => {
    try {
      setLoadingComments(true);
      const response = await getComments(productId, 1, 50);
      setComments(response.items);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleSendComment = async () => {
    if (!selectedProductId || !commentText.trim() || sendingComment) return;
    
    const product = items.find(p => p.id === selectedProductId);
    if (product?.commentsEnabled === false) {
      toast.show({ type: 'error', message: t('comments.disabled') || 'Yorumlar kapalı' });
      return;
    }
    
    try {
      setSendingComment(true);
      const newComment = await createComment(selectedProductId, commentText.trim());
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
      // Update comment count in feed
      setItems(prev => prev.map(p => 
        p.id === selectedProductId 
          ? { ...p, commentCount: (p.commentCount || 0) + 1 }
          : p
      ));
    } catch (error: any) {
      toast.show({ type: 'error', message: error.message || t('comments.error') || 'Yorum eklenemedi' });
    } finally {
      setSendingComment(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const wasLiked = comment.isLiked;
    const oldLikeCount = comment.likeCount;
    
    // Optimistic update
    setComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, isLiked: !wasLiked, likeCount: wasLiked ? oldLikeCount - 1 : oldLikeCount + 1 }
        : c
    ));
    
    try {
      if (wasLiked) {
        await unlikeComment(commentId);
      } else {
        await likeComment(commentId);
      }
    } catch (error) {
      // Revert on error
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, isLiked: wasLiked, likeCount: oldLikeCount }
          : c
      ));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      t('comments.delete') || 'Yorumu Sil',
      t('comments.deleteConfirm') || 'Bu yorumu silmek istediğinize emin misiniz?',
      [
        { text: t('common.cancel') || 'İptal', style: 'cancel' },
        {
          text: t('common.delete') || 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(commentId);
              setComments(prev => prev.filter(c => c.id !== commentId));
              // Update comment count in feed
              if (selectedProductId) {
                setItems(prev => prev.map(p => 
                  p.id === selectedProductId 
                    ? { ...p, commentCount: Math.max((p.commentCount || 1) - 1, 0) }
                    : p
                ));
              }
              toast.show({ type: 'success', message: t('comments.deleted') || 'Yorum silindi' });
            } catch (error: any) {
              toast.show({ type: 'error', message: error.message || t('comments.deleteError') || 'Yorum silinemedi' });
            }
          }
        }
      ]
    );
  };

  const goToKeywordSearch = (keyword: string) => {
    const q = (keyword || '').trim();
    if (!q) return;
    const normalized = q.startsWith('#') ? q.substring(1) : q;
    nav.navigate('Search', { initialQuery: normalized });
  };

  const renderHashtags = (raw: string) => {
    const parts = raw
      .split(/\s+/)
      .map(p => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;

    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {parts.map((tag, idx) => (
          <Pressable
            key={`${tag}-${idx}`}
            onPress={() => goToKeywordSearch(tag)}
            style={{
              backgroundColor: colors.primary + '20',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.primary + '30',
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
              {tag}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderFeedItem = ({ item }: { item: FeedProduct }) => (
    <View style={{ 
      backgroundColor: colors.surface,
      marginBottom: 1,
      borderBottomWidth: 8,
      borderBottomColor: colors.background,
    }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        <Pressable
          onPress={() => nav.navigate('UserProfile', { userId: item.userId })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
          }}
        >
          {item.userAvatarUrl ? (
            <Image
              source={{ uri: fixImageUrlForEmulator(item.userAvatarUrl) }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                marginRight: 12,
                backgroundColor: colors.border,
              }}
              contentFit="cover"
              transition={200}
              cachePolicy="disk"
              onError={(e) => console.warn('[HomeScreen] Feed avatar load error', e?.error)}
            />
          ) : (
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.primary + '30',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>
                {(item.user || '').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 14, 
              fontWeight: '600' 
            }}>
              {item.user}
            </Text>
            {item.category && (
              <Text style={{ 
                color: colors.textMuted, 
                fontSize: 12 
              }}>
                {item.category}
              </Text>
            )}
          </View>
        </Pressable>
        
        {/* Follow Button - Sadece takip edilmeyen kullanıcılar için */}
        {token && item.userId && currentUserId && item.userId !== currentUserId && !(followingMap[item.userId!] || false) && (
          <Pressable
            onPress={() => handleFollowToggle(item.userId!, false)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: colors.primary,
              borderWidth: 1,
              borderColor: colors.primary,
              marginRight: 8,
            }}
          >
            <Text style={{
              color: 'white',
              fontSize: 12,
              fontWeight: '600',
            }}>
              {t('follow.follow')}
            </Text>
          </Pressable>
        )}
        
        <Text style={{ 
          color: colors.textMuted, 
          fontSize: 12 
        }}>
          {new Date(item.createdAt).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short'
          })}
        </Text>
      </View>

      {/* Photos - Scrollable */}
      <View style={{ position: 'relative' }}>
        {item.photos && item.photos.length > 0 ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={!isPinchingPhoto[item.id]}
              onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / screenWidth);
                setPhotoIndices(prev => ({ ...prev, [item.id]: index }));
              }}
              scrollEventThrottle={16}
            >
              {item.photos.map((photo, index) => (
                <Pressable 
                  key={index}
                  onPress={() => {
                    if (!isPinchingPhoto[item.id]) {
                      nav.navigate('ProductDetail', { productId: item.id });
                    }
                  }}
                  style={{
                    width: screenWidth,
                    height: screenWidth,
                    overflow: 'hidden',
                    backgroundColor: colors.border,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <PinchZoomImage
                    uri={fixImageUrlForEmulator(photo.blobUrl)}
                    style={{ 
                      width: '100%', 
                      height: '100%',
                    }}
                    contentFit="cover"
                    onPinchActiveChange={(active) => {
                      setIsPinchingPhoto(prev => ({ ...prev, [item.id]: active }));
                    }}
                    containerWidth={screenWidth}
                    containerHeight={screenWidth}
                  />
                  {/* Badges */}
                  {item.badges && item.badges.length > 0 && (
                    <ProductBadges 
                      badges={item.badges as ProductBadgeType[]}
                      size="small"
                      showText={true}
                      position="top-right"
                      maxBadges={2}
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            
            {/* Pagination Dots */}
            {item.photos.length > 1 && (
              <View style={{
                position: 'absolute',
                bottom: 12,
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {item.photos.map((_, index) => (
                  <View
                    key={index}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: (photoIndices[item.id] || 0) === index ? colors.primary : 'rgba(255,255,255,0.5)',
                      marginHorizontal: 3,
                    }}
                  />
                ))}
              </View>
            )}
          </>
        ) : item.firstPhotoUrl ? (
          <Pressable 
            onPress={() => nav.navigate('ProductDetail', { productId: item.id })}
            style={{
              width: screenWidth,
              height: screenWidth,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Image 
              source={{ uri: fixImageUrlForEmulator(item.firstPhotoUrl) }} 
              style={{ 
                width: '100%', 
                height: '100%',
                backgroundColor: colors.border,
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
                showText={true}
                position="top-right"
                maxBadges={2}
              />
            )}
          </Pressable>
        ) : (
          <Pressable 
            onPress={() => nav.navigate('ProductDetail', { productId: item.id })}
            style={{
              width: screenWidth,
              height: screenWidth,
            }}
          >
            <View style={{
              width: '100%',
              height: '100%',
              backgroundColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="image-outline" size={48} color={colors.textMuted} />
            </View>
          </Pressable>
        )}
      </View>

      {/* Actions */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}>
        <Pressable 
          style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => toggleLike(item.id)}
        >
          <Ionicons 
            name={item.isLiked ? 'heart' : 'heart-outline'} 
            size={24} 
            color={item.isLiked ? '#e91e63' : colors.text} 
          />
          <Pressable onPress={() => openLikers(item)}>
            <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '600' }}>
              {(item.likeCount ?? 0)}
            </Text>
          </Pressable>
        </Pressable>
        <Pressable 
          style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => {
            const product = items.find(p => p.id === item.id);
            if (product?.commentsEnabled !== false) {
              setSelectedProductId(item.id);
              setCommentsOpen(true);
              loadCommentsForProduct(item.id);
            } else {
              toast.show({ type: 'info', message: t('comments.disabled') || 'Yorumlar kapalı' });
            }
          }}
        >
          <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          {item.commentCount !== undefined && item.commentCount > 0 && (
            <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '600', fontSize: 14 }}>
              {item.commentCount}
            </Text>
          )}
        </Pressable>
        <Pressable 
          style={{ marginRight: 16 }}
          onPress={() => shareProduct(item)}
        >
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => toggleSave(item.id)}>
          <Ionicons name={item.isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={item.isSaved ? colors.primary : colors.text} />
        </Pressable>
      </View>

      {/* Content */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ 
          color: colors.text, 
          fontSize: 16, 
          fontWeight: '600',
          marginBottom: 4,
        }}>
          {item.title}
        </Text>
        
        {item.description && (
          <Text style={{ 
            color: colors.text, 
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 8,
          }}>
            {item.description}
          </Text>
        )}
        
        {item.hashtags && (
          <View style={{ marginTop: 2 }}>
            {renderHashtags(item.hashtags)}
          </View>
        )}
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={{ 
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ marginRight: 12 }}>
            <Logo size={32} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 24, 
              fontWeight: '700',
            }}>
              Save{' '}
            </Text>
            <Text style={{ 
              color: '#FF7A59', 
              fontSize: 24, 
              fontWeight: '700',
            }}>
              Al
            </Text>
          <Text style={{ 
            color: colors.text, 
            fontSize: 24, 
            fontWeight: '700',
          }}>
              l
          </Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* AI Credits Indicator */}
          <AICreditIndicator size="small" showLabel={false} />
          
          {/* Notifications */}
        <Pressable onPress={() => { nav.navigate('Notifications'); }} style={{ position: 'relative' }}>
          <Ionicons 
            name={unreadNotificationCount > 0 ? "notifications" : "notifications-outline"} 
            size={24} 
            color={colors.text} 
          />
          {unreadNotificationCount > 0 && (
            <View style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: colors.primary,
              borderRadius: 10,
              minWidth: 20,
              height: 20,
              paddingHorizontal: 6,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: colors.background,
            }}>
              <Text style={{
                color: '#fff',
                fontSize: 11,
                fontWeight: '700',
              }}>
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </Text>
            </View>
          )}
        </Pressable>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loading || page === 1) return null;
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center',
      paddingVertical: 100,
    }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🏠</Text>
      <Text style={{ 
        color: colors.textMuted, 
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        {t('home.noProducts')}
      </Text>
      <Text style={{ 
        color: colors.textMuted, 
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
      }}>
        {t('home.publicFeed')}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar 
        barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.surface}
      />
      
      <SafeAreaView style={{ flex: 1 }}>
        {renderHeader()}
        
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderFeedItem}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={!refreshing ? renderEmpty : null}
          showsVerticalScrollIndicator={false}
        />

        {/* Likers Modal */}
        {likersOpen && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setLikersOpen(false)} />
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%', paddingTop: 12 }}>
              <View style={{ alignItems: 'center', paddingBottom: 8 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              </View>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, paddingHorizontal: 16, paddingBottom: 12 }}>Beğenenler</Text>
              <FlatList
                data={likers}
                keyExtractor={(x) => x.userId}
                renderItem={({ item }) => (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '30', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontWeight: '700' }}>{(item.displayName || 'U')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{item.displayName}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{new Date(item.likedAt).toLocaleString('tr-TR')}</Text>
                    </View>
                  </View>
                )}
                style={{ maxHeight: '60%' }}
              />
              <Pressable onPress={() => setLikersOpen(false)} style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Kapat</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Comments Bottom Sheet - Instagram Style */}
        <Modal
          visible={commentsOpen}
          transparent
          animationType="slide"
          onRequestClose={() => {
            // Android'de klavye açıkken modal'ı kapatma
            if (Platform.OS === 'android' && isKeyboardVisible) {
              Keyboard.dismiss();
              return;
            }
            setCommentsOpen(false);
            setSelectedProductId(null);
            setCommentText('');
          }}
          statusBarTranslucent
        >
          <View style={{ flex: 1 }}>
            <Pressable 
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
              onPress={() => {
                Keyboard.dismiss();
                setCommentsOpen(false);
                setSelectedProductId(null);
                setCommentText('');
              }}
              android_ripple={null}
            />
            {Platform.OS === 'android' ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <View 
                  style={{ 
                    backgroundColor: colors.surface,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    maxHeight: '85%',
                    // Android'de Modal içinde KeyboardAvoidingView her zaman stabil çalışmıyor.
                    // Bu yüzden klavye yüksekliği kadar bottom padding vererek input'un klavyenin üstünde kalmasını garanti ediyoruz.
                    paddingBottom: isKeyboardVisible ? keyboardHeight : 0,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  onStartShouldSetResponder={() => true}
                >
              {/* Handle Bar */}
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <View style={{ 
                  width: 40, 
                  height: 4, 
                  borderRadius: 2, 
                  backgroundColor: colors.border 
                }} />
              </View>

              {/* Header */}
              <View style={{ 
                paddingHorizontal: 20,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Text style={{ 
                  color: colors.text, 
                  fontSize: 18, 
                  fontWeight: '700',
                }}>
                  {t('comments.title') || 'Yorumlar'} {comments.length > 0 && `(${comments.length})`}
                </Text>
                <Pressable onPress={() => {
                  setCommentsOpen(false);
                  setSelectedProductId(null);
                  setCommentText('');
                }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              {/* Comments List */}
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
                showsVerticalScrollIndicator={true}
              >
                {loadingComments ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.primary} size="large" />
                  </View>
                ) : comments.length === 0 ? (
                  <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                    <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
                    <Text style={{ 
                      color: colors.textMuted, 
                      fontSize: 16,
                      marginTop: 16,
                      textAlign: 'center',
                    }}>
                      {t('comments.noComments') || 'Henüz yorum yok. İlk yorumu sen yap!'}
                    </Text>
                  </View>
                ) : (
                  <View>
                    {comments.map((comment) => (
                      <View key={comment.id} style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          {/* User Avatar */}
                          <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: colors.primary + '30',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}>
                            <Text style={{ 
                              color: colors.primary, 
                              fontWeight: '700',
                              fontSize: 16,
                            }}>
                              {(comment.user || 'U')[0].toUpperCase()}
                            </Text>
                          </View>

                          {/* Comment Content */}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                              <Text style={{ 
                                color: colors.text, 
                                fontWeight: '700',
                                fontSize: 14,
                                marginRight: 8,
                              }}>
                                {comment.user}
                              </Text>
                              <Text style={{ 
                                color: colors.textMuted, 
                                fontSize: 12,
                              }}>
                                {new Date(comment.createdAt).toLocaleDateString('tr-TR', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: new Date(comment.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                                })}
                              </Text>
                            </View>
                            <Text style={{ 
                              color: colors.text, 
                              fontSize: 14,
                              lineHeight: 20,
                              marginBottom: 8,
                            }}>
                              {comment.text}
                            </Text>

                            {/* Comment Actions */}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Pressable 
                                onPress={() => handleLikeComment(comment.id)}
                                style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}
                              >
                                <Ionicons 
                                  name={comment.isLiked ? 'heart' : 'heart-outline'} 
                                  size={18} 
                                  color={comment.isLiked ? '#e91e63' : colors.textMuted} 
                                />
                                {comment.likeCount > 0 && (
                                  <Text style={{ 
                                    marginLeft: 6, 
                                    color: colors.textMuted, 
                                    fontSize: 13,
                                    fontWeight: '600',
                                  }}>
                                    {comment.likeCount}
                                  </Text>
                                )}
                              </Pressable>
                              {/* Delete button - sadece kendi yorumlarında göster */}
                              {currentUserId && comment.userId === currentUserId && (
                                <Pressable onPress={() => handleDeleteComment(comment.id)}>
                                  <Text style={{ 
                                    color: '#ff4444', 
                                    fontSize: 13,
                                    fontWeight: '600',
                                  }}>
                                    {t('comments.delete') || 'Sil'}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Comment Input - Fixed at Bottom */}
              {selectedProductId && (() => {
                const product = items.find(p => p.id === selectedProductId);
                return product?.commentsEnabled !== false && (
                    <View style={{ 
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor: colors.surface,
                    }}>
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center',
                      }}>
                        <View style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: colors.primary + '30',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          <Text style={{ 
                            color: colors.primary, 
                            fontWeight: '700',
                            fontSize: 14,
                          }}>
                            {currentUserId ? 'U' : 'U'}
                          </Text>
                        </View>
                        <TextInput
                          value={commentText}
                          onChangeText={setCommentText}
                          placeholder={t('comments.placeholder') || 'Yorum ekle...'}
                          placeholderTextColor={colors.textMuted}
                          multiline
                          style={{
                            flex: 1,
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            color: colors.text,
                            fontSize: 14,
                            maxHeight: 100,
                          }}
                        />
                        <Pressable 
                          onPress={handleSendComment}
                          disabled={!commentText.trim() || sendingComment}
                          style={{
                            marginLeft: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            backgroundColor: commentText.trim() ? colors.primary : colors.surface,
                            borderRadius: 20,
                            opacity: commentText.trim() ? 1 : 0.5,
                          }}
                        >
                          {sendingComment ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Ionicons name="send" size={18} color={commentText.trim() ? 'white' : colors.textMuted} />
                          )}
                        </Pressable>
                      </View>
                    </View>
                );
              })()}
                </View>
              </View>
            ) : (
              <View 
                style={{ 
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  maxHeight: '85%',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                onStartShouldSetResponder={() => true}
              >
              {/* Handle Bar */}
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <View style={{ 
                  width: 40, 
                  height: 4, 
                  borderRadius: 2, 
                  backgroundColor: colors.border 
                }} />
              </View>

              {/* Header */}
              <View style={{ 
                paddingHorizontal: 20,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Text style={{ 
                  color: colors.text, 
                  fontSize: 18, 
                  fontWeight: '700',
                }}>
                  {t('comments.title') || 'Yorumlar'} {comments.length > 0 && `(${comments.length})`}
                </Text>
                <Pressable onPress={() => {
                  setCommentsOpen(false);
                  setSelectedProductId(null);
                  setCommentText('');
                }}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              {/* Comments List */}
              <ScrollView 
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
                showsVerticalScrollIndicator={true}
              >
                {loadingComments ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.primary} size="large" />
                  </View>
                ) : comments.length === 0 ? (
                  <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                    <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
                    <Text style={{ 
                      color: colors.textMuted, 
                      fontSize: 16,
                      marginTop: 16,
                      textAlign: 'center',
                    }}>
                      {t('comments.noComments') || 'Henüz yorum yok. İlk yorumu sen yap!'}
                    </Text>
                  </View>
                ) : (
                  <View>
                    {comments.map((comment) => (
                      <View key={comment.id} style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                          {/* User Avatar */}
                          <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: colors.primary + '30',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}>
                            <Text style={{ 
                              color: colors.primary, 
                              fontWeight: '700',
                              fontSize: 16,
                            }}>
                              {(comment.user || 'U')[0].toUpperCase()}
                            </Text>
                          </View>

                          {/* Comment Content */}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                              <Text style={{ 
                                color: colors.text, 
                                fontWeight: '700',
                                fontSize: 14,
                                marginRight: 8,
                              }}>
                                {comment.user}
                              </Text>
                              <Text style={{ 
                                color: colors.textMuted, 
                                fontSize: 12,
                              }}>
                                {new Date(comment.createdAt).toLocaleDateString('tr-TR', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: new Date(comment.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
                                })}
                              </Text>
                            </View>
                            <Text style={{ 
                              color: colors.text, 
                              fontSize: 14,
                              lineHeight: 20,
                              marginBottom: 8,
                            }}>
                              {comment.text}
                            </Text>

                            {/* Comment Actions */}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Pressable 
                                onPress={() => handleLikeComment(comment.id)}
                                style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}
                              >
                                <Ionicons 
                                  name={comment.isLiked ? 'heart' : 'heart-outline'} 
                                  size={18} 
                                  color={comment.isLiked ? '#e91e63' : colors.textMuted} 
                                />
                                {comment.likeCount > 0 && (
                                  <Text style={{ 
                                    marginLeft: 6, 
                                    color: colors.textMuted, 
                                    fontSize: 13,
                                    fontWeight: '600',
                                  }}>
                                    {comment.likeCount}
                                  </Text>
                                )}
                              </Pressable>
                              {/* Delete button - sadece kendi yorumlarında göster */}
                              {currentUserId && comment.userId === currentUserId && (
                                <Pressable onPress={() => handleDeleteComment(comment.id)}>
                                  <Text style={{ 
                                    color: '#ff4444', 
                                    fontSize: 13,
                                    fontWeight: '600',
                                  }}>
                                    {t('comments.delete') || 'Sil'}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Comment Input - Fixed at Bottom */}
              {selectedProductId && (() => {
                const product = items.find(p => p.id === selectedProductId);
                return product?.commentsEnabled !== false && (
                    <View style={{ 
                      paddingHorizontal: 20,
                      paddingTop: 12,
                      paddingBottom: 12 + keyboardHeight,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      backgroundColor: colors.surface,
                    }}>
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center',
                      }}>
                        <View style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: colors.primary + '30',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          <Text style={{ 
                            color: colors.primary, 
                            fontWeight: '700',
                            fontSize: 14,
                          }}>
                            {currentUserId ? 'U' : 'U'}
                          </Text>
                        </View>
                        <TextInput
                          value={commentText}
                          onChangeText={setCommentText}
                          placeholder={t('comments.placeholder') || 'Yorum ekle...'}
                          placeholderTextColor={colors.textMuted}
                          multiline
                          style={{
                            flex: 1,
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: 20,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            color: colors.text,
                            fontSize: 14,
                            maxHeight: 100,
                          }}
                        />
                        <Pressable 
                          onPress={handleSendComment}
                          disabled={!commentText.trim() || sendingComment}
                          style={{
                            marginLeft: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            backgroundColor: commentText.trim() ? colors.primary : colors.surface,
                            borderRadius: 20,
                            opacity: commentText.trim() ? 1 : 0.5,
                          }}
                        >
                          {sendingComment ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <Ionicons name="send" size={18} color={commentText.trim() ? 'white' : colors.textMuted} />
                          )}
                        </Pressable>
                      </View>
                    </View>
                );
              })()}
              </View>
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

