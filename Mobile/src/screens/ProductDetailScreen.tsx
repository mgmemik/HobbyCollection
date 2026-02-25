import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  FlatList,
  Modal,
  Animated,
  Platform,
  Keyboard,
  Share,
  Switch
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getProduct, getPublicProduct, deleteProduct, ProductDetail, likeProduct, unlikeProduct, getProductLikers, ProductLiker, saveProduct, unsaveProduct, getComments, createComment, deleteComment, likeComment, unlikeComment, Comment, updateProduct } from '../api/products';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import { fetchUserPreferences } from '../api/userPreferences';
import { base64Decode } from '../api/auth';
import { ProductBadges, ProductBadgeType } from '../components/ProductBadge';
import { fixImageUrlForEmulator } from '../utils/imageUrl';
import { PinchZoomImage } from '../components/PinchZoomImage';
import { Image as ExpoImage } from 'expo-image';
import { ReportModal } from '../components/ReportModal';

const { width: screenWidth } = Dimensions.get('window');
const { height: screenHeight } = Dimensions.get('window');

export const ProductDetailScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, openComments: openCommentsParam, focusCommentId } = route.params as {
    productId: string;
    openComments?: boolean;
    focusCommentId?: string;
  };
  const insets = useSafeAreaInsets();
  
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportContentType, setReportContentType] = useState<'product' | 'user' | 'comment'>('product');
  const [reportContentId, setReportContentId] = useState<string>('');
  const [reportContentTitle, setReportContentTitle] = useState<string | undefined>(undefined);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likersOpen, setLikersOpen] = useState(false);
  const [likers, setLikers] = useState<ProductLiker[]>([]);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [updatingPublic, setUpdatingPublic] = useState<boolean>(false);
  const [currency, setCurrency] = useState<string>('TRY');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number>(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState<string>('');
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [sendingComment, setSendingComment] = useState<boolean>(false);
  const [commentPage, setCommentPage] = useState<number>(1);
  const [hasMoreComments, setHasMoreComments] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(Dimensions.get('window').height);
  const [photoViewerOpen, setPhotoViewerOpen] = useState<boolean>(false);
  const [photoViewerUri, setPhotoViewerUri] = useState<string | null>(null);
  const [isPinchingPhoto, setIsPinchingPhoto] = useState<boolean>(false);

  const openPhotoViewer = (uri: string) => {
    setPhotoViewerUri(uri);
    setPhotoViewerOpen(true);
  };

  const closePhotoViewer = () => {
    setPhotoViewerOpen(false);
    setPhotoViewerUri(null);
  };

  const shareProduct = async () => {
    if (!product) return;
    try {
      const title = product.title || 'Ürün';
      const desc = product.description ? `\n\n${product.description}` : '';
      const hashtags = product.hashtags ? `\n\n${product.hashtags}` : '';
      const message = `${title}${desc}${hashtags}`.trim();

      const firstPhotoUrl =
        product.photos?.[0]?.blobUrl ||
        (product as any).firstPhotoUrl ||
        undefined;

      await Share.share({
        message,
        url: firstPhotoUrl,
      });
    } catch (e: any) {
      toast.show({ type: 'error', message: e?.message || (t('common.error') || 'Hata') });
    }
  };

  const goToKeywordSearch = (keyword: string) => {
    const q = (keyword || '').trim();
    if (!q) return;
    const normalized = q.startsWith('#') ? q.substring(1) : q;
    (navigation as any).navigate('Main', { screen: 'Search', params: { initialQuery: normalized } });
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

  useEffect(() => {
    loadProduct();
    loadComments();
  }, [productId]);

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

  // Ekran her odağa geldiğinde ürünü yeniden yükle (edit sonrası güncel foto sayısını al)
  useFocusEffect(
    React.useCallback(() => {
      loadProduct();
      return () => {};
    }, [productId])
  );

  const loadProduct = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
      setLoading(true);
      }
      const token = (await AsyncStorage.getItem('auth_token')) || '';
      
      // Reset photo index when loading new product
      setCurrentPhotoIndex(0);
      
      // Load current user ID and preferences
      try {
        if (token) {
          // Try to decode JWT to get user ID
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = parts[1];
              const decodedStr = base64Decode(payload);
              const decoded = JSON.parse(decodedStr);
              const userId = decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || null;
              setCurrentUserId(userId);
              console.log('Decoded user ID from token:', userId);
            }
          } catch (e) {
            // If JWT decode fails, that's okay - we'll just not show user info for own products
            console.log('Could not decode JWT:', e);
          }
          const prefs = await fetchUserPreferences(token);
          if (prefs?.currency) {
            setCurrency(prefs.currency);
          }
        }
      } catch {}
      
      // Önce kendi ürününüzü yüklemeye çalış
      try {
        const data = await getProduct(productId, token);
        setProduct(data);
        setLikeCount(data.likeCount ?? 0);
        setIsLiked(data.isLiked ?? false);
        setIsSaved(data.isSaved ?? false);
        setIsPublic(data.isPublic ?? true);
        return;
      } catch (error) {
        // Kendi ürününüz değilse, public endpoint'i dene
        console.log('Not owner product, trying public endpoint...');
        const publicData = await getPublicProduct(productId, token);
        setProduct(publicData);
        setLikeCount(publicData.likeCount ?? 0);
        setIsLiked(publicData.isLiked ?? false);
        setIsSaved(publicData.isSaved ?? false);
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadProduct(true);
    loadComments();
  };

  const loadComments = useCallback(async () => {
    if (!product?.commentsEnabled) return;
    try {
      setLoadingComments(true);
      const response = await getComments(productId, 1, 50);
      setComments(response.items);
      setHasMoreComments(response.items.length < response.total);
      setCommentPage(1);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  }, [product?.commentsEnabled, productId]);

  // Bildirimden gelindiyse yorumlar sheet'ini direkt aç
  useEffect(() => {
    if (!openCommentsParam) return;
    setCommentsOpen(true);
    // Ürün yüklendikten sonra yorumları çek
    if (product?.commentsEnabled) {
      void loadComments();
    }
    // focusCommentId şimdilik sadece param olarak taşınıyor;
    // ileride yorum listesinde highlight/scroll eklenebilir.
  }, [openCommentsParam, product?.commentsEnabled, loadComments, focusCommentId]);

  const handleSendComment = async () => {
    if (!commentText.trim() || sendingComment) return;
    if (!product?.commentsEnabled) {
      toast.show({ type: 'error', message: t('comments.disabled') || 'Yorumlar kapalı' });
      return;
    }
    
    try {
      setSendingComment(true);
      const newComment = await createComment(productId, commentText.trim());
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
      // Toast gösterme - Instagram'da yok
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
              toast.show({ type: 'success', message: t('comments.deleted') || 'Yorum silindi' });
            } catch (error: any) {
              toast.show({ type: 'error', message: error.message || t('comments.deleteError') || 'Yorum silinemedi' });
            }
          }
        }
      ]
    );
  };

  const toggleLike = async () => {
    // Mevcut state'i sakla (optimistic update için)
    const currentLiked = isLiked;
    const currentCount = likeCount;
    
    // Optimistic update
    setIsLiked(prev => !prev);
    setLikeCount(prev => prev + (currentLiked ? -1 : 1));
    
    try {
      if (currentLiked) {
        await unlikeProduct(productId);
      } else {
        await likeProduct(productId);
      }
    } catch (e) {
      // Hata durumunda geri al
      setIsLiked(currentLiked);
      setLikeCount(currentCount);
      toast.show({ type: 'error', message: t('productDetail.error') || 'Bir hata oluştu' });
    }
  };

  const openLikers = async () => {
    try {
      const res = await getProductLikers(productId, 1, 50);
      setLikers(res.items);
      setLikersOpen(true);
    } catch (e) {}
  };

  const toggleSave = async () => {
    const next = !isSaved;
    setIsSaved(next);
    try {
      if (next) await saveProduct(productId); else await unsaveProduct(productId);
    } catch (e) {
      setIsSaved(!next);
    }
  };

  const handleUpdatePublic = async (value: boolean) => {
    if (!product || product.userId !== currentUserId) return;
    
    setUpdatingPublic(true);
    const previousValue = isPublic;
    setIsPublic(value);
    
    try {
      const token = (await AsyncStorage.getItem('auth_token')) || '';
      await updateProduct(productId, { isPublic: value }, token);
      setProduct(prev => prev ? { ...prev, isPublic: value } : null);
      toast.show({ 
        type: 'success', 
        message: value 
          ? (t('productDetail.sharingEnabled') || 'Paylaşım açıldı. Ürününüz artık herkese görünür.')
          : (t('productDetail.sharingDisabled') || 'Paylaşım kapatıldı. Ürününüz artık özel.')
      });
    } catch (e: any) {
      setIsPublic(previousValue);
      toast.show({ type: 'error', message: e?.message || t('productDetail.productUpdateError') || 'Güncellenemedi' });
    } finally {
      setUpdatingPublic(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      t('productDetail.delete') || 'Ürünü Sil',
      t('productDetail.deleteConfirm') || 'Bu ürünü silmek istediğinizden emin misiniz?',
      [
        { text: t('common.cancel') || 'İptal', style: 'cancel' },
        {
          text: t('common.delete') || 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = (await AsyncStorage.getItem('auth_token')) || '';
              await deleteProduct(productId, token);
              toast.show({ type: 'success', message: t('productDetail.deleted'), subMessage: t('productDetail.deletedSuccess') });
              navigation.goBack();
            } catch (error) {
              toast.show({ type: 'error', message: t('productDetail.error'), subMessage: t('productDetail.deleteErrorMsg') });
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontSize: 16 }}>{t('productDetail.notFound')}</Text>
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
      
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
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
          
          <Text style={{ 
            color: colors.text, 
            fontSize: 18, 
            fontWeight: '700',
            flex: 1,
          }} numberOfLines={1}>
            {product?.title || ''}
          </Text>

          {/* Menü butonu - Kendi ürününde ve başka kullanıcının ürününde göster */}
          {currentUserId && product?.userId && (
            <Pressable 
              onPress={() => setMenuOpen(true)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
            </Pressable>
          )}
        </View>

        {/* Content */}
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Photos */}
          {(() => {
            const uniquePhotos = (product.photos || []).filter((p, i, arr) =>
              arr.findIndex(x => x.blobUrl === p.blobUrl) === i
            );
            return uniquePhotos.length > 1 ? (
            <View style={{ marginBottom: 24, position: 'relative' }}>
            {/* User Info - Instagram style (overlay on photo) */}
            {product.userId && product.user && (!currentUserId || product.userId !== currentUserId) && (
              <View style={{
                position: 'absolute',
                top: 24,
                left: 28,
                zIndex: 10,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
              }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}>
                  <Ionicons name="person" size={16} color="white" />
                </View>
                <Text style={{
                  color: 'white',
                  fontSize: 14,
                  fontWeight: '600',
                }} numberOfLines={1}>
                  {product.user}
                </Text>
              </View>
            )}
            <ScrollView 
              horizontal 
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEnabled={!isPinchingPhoto}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                setCurrentPhotoIndex(index);
              }}
              onScrollBeginDrag={() => {
                // Scroll başladığında index'i güncelle
              }}
            >
              {uniquePhotos.map((photo, index) => (
                <View key={`${photo.order}-${index}`} style={{ width: screenWidth, position: 'relative' }}>
                  <Pressable
                    onPress={() => {
                      if (!isPinchingPhoto) {
                        openPhotoViewer(fixImageUrlForEmulator(photo.blobUrl));
                      }
                    }}
                    style={{ 
                      width: screenWidth - 32, 
                      height: screenWidth - 32,
                      borderRadius: 16,
                      marginHorizontal: 16,
                      backgroundColor: colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden',
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
                        setIsPinchingPhoto(active);
                      }}
                      containerWidth={screenWidth - 32}
                      containerHeight={screenWidth - 32}
                    />
                  </Pressable>
                  {/* Badges - sadece ilk fotoda göster */}
                  {index === 0 && product.badges && product.badges.length > 0 && (
                    <View style={{ position: 'absolute', top: 0, right: 0, left: 0, bottom: 0 }}>
                      <ProductBadges 
                        badges={product.badges as ProductBadgeType[]}
                        size="medium"
                        showText={true}
                        position="top-right"
                        maxBadges={3}
                      />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
              
              {/* User Info Overlay - Instagram style (top left of photo) */}
              {product.userId && product.user && (!currentUserId || product.userId !== currentUserId) && (
                <View style={{
                  position: 'absolute',
                  top: 28,
                  left: 28,
                  zIndex: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 8,
                  }}>
                    <Ionicons name="person" size={16} color="white" />
                  </View>
                  <Text style={{
                    color: 'white',
                    fontSize: 14,
                    fontWeight: '600',
                    maxWidth: 150,
                  }} numberOfLines={1}>
                    {product.user}
                  </Text>
                </View>
              )}
              
              {/* Photo Pagination Indicator */}
              <View style={{
                position: 'absolute',
                bottom: 16,
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {uniquePhotos.map((_, index) => (
                  <View
                    key={index}
                    style={{
                      width: currentPhotoIndex === index ? 8 : 6,
                      height: currentPhotoIndex === index ? 8 : 6,
                      borderRadius: currentPhotoIndex === index ? 4 : 3,
                      backgroundColor: currentPhotoIndex === index ? 'white' : 'rgba(255,255,255,0.5)',
                      marginHorizontal: 3,
                    }}
                  />
                ))}
              </View>
              
              {/* Photo Count Badge */}
              <View style={{
                position: 'absolute',
                top: 16,
                right: 16,
                backgroundColor: 'rgba(0,0,0,0.7)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <Ionicons name="images" size={18} color="white" />
                <Text style={{ 
                  color: 'white', 
                  fontSize: 16, 
                  fontWeight: '700',
                  marginLeft: 6,
                }}>
                  {currentPhotoIndex + 1}/{uniquePhotos.length}
                </Text>
              </View>
            </View>
            ) : (
            <View style={{ marginBottom: 24, position: 'relative' }}>
              {uniquePhotos[0] && (
                <>
                  {/* User Info Overlay - Instagram style (top left of photo) */}
                  {product.userId && product.user && (!currentUserId || product.userId !== currentUserId) && (
                    <View style={{
                      position: 'absolute',
                      top: 12,
                      left: 28,
                      zIndex: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0.6)',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                      }}>
                        <Ionicons name="person" size={16} color="white" />
                      </View>
                      <Text style={{
                        color: 'white',
                        fontSize: 14,
                        fontWeight: '600',
                        maxWidth: 150,
                      }} numberOfLines={1}>
                        {product.user}
                      </Text>
                    </View>
                  )}
                <Pressable
                  onPress={() => {
                    if (!isPinchingPhoto) {
                      openPhotoViewer(fixImageUrlForEmulator(uniquePhotos[0].blobUrl));
                    }
                  }}
                  style={{
                    width: screenWidth - 32,
                    height: screenWidth - 32,
                    borderRadius: 16,
                    marginHorizontal: 16,
                    overflow: 'hidden',
                    backgroundColor: colors.border,
                  }}
                >
                  <PinchZoomImage
                    uri={fixImageUrlForEmulator(uniquePhotos[0].blobUrl)}
                    style={{ 
                      width: '100%', 
                      height: '100%',
                    }}
                    contentFit="cover"
                    onPinchActiveChange={(active) => {
                      setIsPinchingPhoto(active);
                    }}
                    containerWidth={screenWidth - 32}
                    containerHeight={screenWidth - 32}
                  />
                </Pressable>
                {/* Badges */}
                {product.badges && product.badges.length > 0 && (
                  <ProductBadges 
                    badges={product.badges as ProductBadgeType[]}
                    size="medium"
                    showText={true}
                    position="top-right"
                    maxBadges={3}
                  />
                )}
                </>
              )}
            </View>
            );
          })()}

          {/* Actions like Instagram */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 }}>
            <Pressable onPress={toggleLike} style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={26} color={isLiked ? '#e91e63' : colors.text} />
              <Pressable onPress={openLikers}>
                <Text style={{ marginLeft: 6, color: colors.text, fontWeight: '700' }}>{likeCount}</Text>
              </Pressable>
            </Pressable>
            <Pressable 
              onPress={() => {
                if (product.commentsEnabled) {
                  setCommentsOpen(true);
                  loadComments();
                } else {
                  toast.show({ type: 'info', message: t('comments.disabled') || 'Yorumlar kapalı' });
                }
              }}
              style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
              {comments.length > 0 && (
                <Text style={{ marginLeft: 4, color: colors.text, fontSize: 12, fontWeight: '600' }}>{comments.length}</Text>
              )}
            </Pressable>
            <Pressable style={{ marginRight: 16 }} onPress={shareProduct}>
              <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
            </Pressable>
            {/* Report button - Sadece başka kullanıcının ürününde göster */}
            {currentUserId && product?.userId && currentUserId !== product.userId && (
              <Pressable 
                style={{ marginRight: 16 }} 
                onPress={() => {
                  setReportContentType('product');
                  setReportContentId(productId);
                  setReportContentTitle(product?.title);
                  setReportModalOpen(true);
                }}
              >
                <Ionicons name="flag-outline" size={24} color={colors.text} />
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable onPress={toggleSave}>
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? colors.primary : colors.text} />
            </Pressable>
          </View>

          {/* Created Date */}
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <Text style={{ 
              color: colors.textMuted, 
              fontSize: 12,
            }}>
              {new Date(product.createdAt).toLocaleDateString('tr-TR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>

          {/* Content */}
          <View style={{ paddingHorizontal: 24 }}>
            {/* Title */}
            <Text style={{ 
              color: colors.text, 
              fontSize: 24, 
              fontWeight: '700',
              marginBottom: 12,
            }}>
              {product.title}
            </Text>

            {/* Description */}
            {!!product.description && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ 
                  color: colors.text, 
                  fontSize: 15,
                  lineHeight: 22,
                  fontWeight: '700',
                }}>
                  {product.description}
                </Text>
              </View>
            )}

            {/* Price */}
            {typeof (product as any).price === 'number' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ 
                  color: colors.text, 
                  fontSize: 18,
                  fontWeight: '700',
                }}>
                  {(() => {
                    const p = (product as any).price as number;
                    try {
                      const localeMap: Record<string, string> = {
                        'TRY': 'tr-TR',
                        'USD': 'en-US',
                        'EUR': 'de-DE',
                        'GBP': 'en-GB',
                        'JPY': 'ja-JP'
                      };
                      const locale = localeMap[currency] || 'tr-TR';
                      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'TRY' }).format(p);
                    } catch {
                      return `${p} ${currency || 'TRY'}`;
                    }
                  })()}
                </Text>
              </View>
            )}

            {/* Hashtags */}
            {!!product.hashtags && (
              <View style={{ marginBottom: 20 }}>
                {renderHashtags(product.hashtags)}
              </View>
            )}

            {/* Category Path */}
            {(() => {
              const categoryPath = (product as any).categoryPath as Array<{ id: string; name: string; slug: string }> | undefined;
              const displayCategory = (product as any).category ?? (product as any).Category;
              
              if (!categoryPath || categoryPath.length === 0) {
                // Fallback: Eski kategori gösterimi
                return displayCategory ? (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ 
                      color: colors.textMuted, 
                      fontSize: 14, 
                      fontWeight: '600',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}>
                      {t('productDetail.category')}
                    </Text>
                    <View style={{
                      backgroundColor: colors.primary + '20',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      alignSelf: 'flex-start',
                    }}>
                      <Text style={{ 
                        color: colors.primary, 
                        fontSize: 14,
                        fontWeight: '600',
                      }}>
                        {displayCategory}
                      </Text>
                    </View>
                  </View>
                ) : null;
              }

              return (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ 
                    color: colors.textMuted, 
                    fontSize: 14, 
                    fontWeight: '600',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>
                    {t('productDetail.category')}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {categoryPath.map((cat, index) => (
                      <View key={cat.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Pressable
                          onPress={() => {
                            // SearchScreen'e yönlendir ve kategori filtresi uygula
                            try {
                              navigation.navigate('Main', {
                                screen: 'Search',
                                params: {
                                  initialCategoryId: cat.id,
                                  initialCategoryName: cat.name,
                                } as any,
                              });
                            } catch (e) {
                              console.error('Navigation error:', e);
                            }
                          }}
                          style={{
                            backgroundColor: colors.primary + '20',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                          }}
                        >
                          <Text style={{ 
                            color: colors.primary, 
                            fontSize: 13,
                            fontWeight: '600',
                          }}>
                            {cat.name}
                          </Text>
                        </Pressable>
                        {index < categoryPath.length - 1 && (
                          <Ionicons 
                            name="chevron-forward" 
                            size={14} 
                            color={colors.textMuted} 
                            style={{ marginHorizontal: 4 }}
                          />
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </View>

        </ScrollView>

        {/* Full Screen Photo Viewer */}
        <Modal
          visible={photoViewerOpen}
          transparent
          animationType="fade"
          onRequestClose={closePhotoViewer}
          statusBarTranslucent
        >
          <View style={{ flex: 1, backgroundColor: 'black' }}>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']} pointerEvents="box-none">
              {/* Close button */}
              <View
                pointerEvents="box-none"
                style={{
                  position: 'absolute',
                  bottom: Math.max(insets.bottom, 12) + 16,
                  right: 16,
                  zIndex: 999,
                }}
              >
                <Pressable
                  onPress={closePhotoViewer}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={24} color="white" />
                </Pressable>
              </View>

              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                {photoViewerUri ? (
                  <View style={{ width: screenWidth, height: screenHeight }}>
                    <PinchZoomImage
                      uri={photoViewerUri}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="contain"
                      containerWidth={screenWidth}
                      containerHeight={screenHeight}
                    />
                  </View>
                ) : (
                  <ActivityIndicator color="white" />
                )}
              </View>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Likers Modal */}
        {likersOpen && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setLikersOpen(false)} />
            <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '60%', paddingTop: 12 }}>
              <View style={{ alignItems: 'center', paddingBottom: 8 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              </View>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, paddingHorizontal: 16, paddingBottom: 12 }}>{t('productDetail.likers')}</Text>
              <ScrollView style={{ maxHeight: '60%' }}>
                {likers.map(l => (
                  <View key={l.userId} style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '30', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontWeight: '700' }}>{(l.displayName || 'U')[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{l.displayName}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{new Date(l.likedAt).toLocaleString('tr-TR')}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Pressable onPress={() => setLikersOpen(false)} style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('productDetail.close')}</Text>
              </Pressable>
            </View>
          </View>
        )}

          {/* Action Menu - Kendi ürünlerinde: Edit/Delete, Başka kullanıcının ürününde: Report */}
        {menuOpen && currentUserId && product?.userId && (
          <>
            {/* Overlay - Dışarı tıklanınca menüyü kapat */}
            <Pressable 
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}
              onPress={() => setMenuOpen(false)}
            />
            <View style={{ position: 'absolute', top: headerHeight + 4, right: 16, zIndex: 2 }}>
              <View style={{ 
                backgroundColor: colors.surface, 
                borderRadius: 12, 
                borderWidth: 1, 
                borderColor: colors.border,
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowOffset: { width: 0, height: 4 },
                shadowRadius: 8,
                elevation: 4,
              }}>
                {/* Kendi ürününde: Edit/Delete/Share, Başka kullanıcının ürününde: Report */}
                {currentUserId === product.userId ? (
                  <>
                    <Pressable onPress={() => { setMenuOpen(false); (navigation as any).navigate('ProductEdit', { productId }); }} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Text style={{ color: colors.text }}>{t('productDetail.edit')}</Text>
                    </Pressable>
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                    <Pressable onPress={() => { setMenuOpen(false); handleDelete(); }} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Text style={{ color: '#ff4444', fontWeight: '600' }}>{t('productDetail.delete')}</Text>
                    </Pressable>
                    <View style={{ height: 1, backgroundColor: colors.border }} />
                    <Pressable onPress={() => { 
                      setMenuOpen(false); 
                      if (product) {
                        setIsPublic(product.isPublic ?? true);
                      }
                      setShareOpen(true); 
                    }} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Text style={{ color: colors.text }}>{t('productDetail.shareSettings')}</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable 
                    onPress={() => {
                      setMenuOpen(false);
                      setReportContentType('product');
                      setReportContentId(productId);
                      setReportContentTitle(product?.title);
                      setReportModalOpen(true);
                    }} 
                    style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                  >
                    <Text style={{ color: '#ff4444', fontWeight: '600' }}>
                      {t('report.title') || 'Şikayet Et'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </>
        )}

        {/* Report Modal */}
        <ReportModal
          visible={reportModalOpen}
          onClose={() => {
            setReportModalOpen(false);
            setReportContentId('');
            setReportContentTitle(undefined);
          }}
          contentType={reportContentType}
          contentId={reportContentId}
          contentTitle={reportContentTitle}
        />

        {/* Share Settings Popup */}
        {shareOpen && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.surface, width: '86%', borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t('productDetail.shareSettings')}</Text>
                <Pressable onPress={() => setShareOpen(false)}><Text style={{ color: colors.primary }}>{t('productDetail.close')}</Text></Pressable>
              </View>
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{t('productDetail.enableSharing')}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                      {isPublic ? (t('productDetail.publicSharing') || 'Herkese açık') : (t('productDetail.privateSharing') || 'Özel')}
                    </Text>
                  </View>
                  <Switch
                    value={isPublic}
                    onValueChange={handleUpdatePublic}
                    disabled={updatingPublic || !product || product.userId !== currentUserId}
                    thumbColor={isPublic ? colors.primary : colors.textMuted}
                    trackColor={{ true: colors.accent + '60', false: colors.border }}
                  />
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>{t('productDetail.shareNote')}</Text>
              </View>
              <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'flex-end' }}>
                <Pressable onPress={() => setShareOpen(false)} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: colors.text }}>{t('productDetail.close')}</Text>
                </Pressable>
              </View>
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
          }}
          statusBarTranslucent
        >
          <View style={{ flex: 1 }}>
            <Pressable 
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
              onPress={() => {
                Keyboard.dismiss();
                setCommentsOpen(false);
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
                <Pressable onPress={() => setCommentsOpen(false)}>
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
                              {/* Report button - Başka kullanıcının yorumlarında göster */}
                              {currentUserId && comment.userId !== currentUserId && (
                                <Pressable 
                                  onPress={() => {
                                    setReportContentType('comment');
                                    setReportContentId(comment.id);
                                    setReportContentTitle(comment.text.substring(0, 50) + (comment.text.length > 50 ? '...' : ''));
                                    setReportModalOpen(true);
                                  }}
                                  style={{ marginLeft: 12 }}
                                >
                                  <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
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
              {product.commentsEnabled && (
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
              )}
                </View>
              </View>
            ) : (
              <View 
                style={{ 
                  position: 'absolute',
                  bottom: keyboardHeight,
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
                <Pressable onPress={() => setCommentsOpen(false)}>
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
                              {/* Report button - Başka kullanıcının yorumlarında göster */}
                              {currentUserId && comment.userId !== currentUserId && (
                                <Pressable 
                                  onPress={() => {
                                    setReportContentType('comment');
                                    setReportContentId(comment.id);
                                    setReportContentTitle(comment.text.substring(0, 50) + (comment.text.length > 50 ? '...' : ''));
                                    setReportModalOpen(true);
                                  }}
                                  style={{ marginLeft: 12 }}
                                >
                                  <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
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
              {product.commentsEnabled && (
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
              )}
              </View>
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

// Menüler
// Header altına ekliyoruz (aynı dosyada component state'lerini kullanır)
