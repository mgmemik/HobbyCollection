import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Pressable,
  StatusBar,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, Notification } from '../api/products';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { acceptFollowRequest, rejectFollowRequest } from '../api/follows';
import { getConversations } from '../api/conversations';
import Constants from 'expo-constants';

export const NotificationsScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation();
  const isExpoGo = Constants.appOwnership === 'expo';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadNotifications = useCallback(async (isRefresh: boolean = false, showError: boolean = true) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await getNotifications(1, 50);
      setNotifications(response.items || []);
      setHasMore((response.items?.length || 0) < (response.total || 0));
      setPage(1);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
      // Sadece ilk yüklemede veya manuel refresh'te hata göster
      // useFocusEffect'ten gelen otomatik yenilemelerde hata gösterme (döngüyü önlemek için)
      if (showError) {
        toast.show({ type: 'error', message: error.message || t('notifications.error') || 'Bildirimler yüklenemedi' });
      }
      // Hata durumunda boş liste set et (döngüyü önlemek için)
      setNotifications([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadNotifications(false, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // useFocusEffect'i kaldırdık - sadece useEffect kullanıyoruz
  // Çünkü useFocusEffect her odaklanmada çalışıyor ve döngü oluşturabiliyor

  const handleRefresh = () => {
    loadNotifications(true, true); // Manuel refresh'te hata göster
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
    } catch (error: any) {
      toast.show({ type: 'error', message: error.message || t('notifications.markReadError') || 'Bildirim işaretlenemedi' });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.show({ type: 'success', message: t('notifications.allMarkedRead') || 'Tüm bildirimler okundu olarak işaretlendi' });
    } catch (error: any) {
      toast.show({ type: 'error', message: error.message || t('notifications.markAllReadError') || 'Bildirimler işaretlenemedi' });
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }
    
    // Ürün ile ilgili bildirimler
    if (notification.relatedProductId && (notification.type === 'product_like' || notification.type === 'comment' || notification.type === 'comment_like' || notification.type === 'new_product')) {
      (navigation as any).navigate('ProductDetail', {
        productId: notification.relatedProductId,
        openComments: notification.type === 'comment' || notification.type === 'comment_like',
        focusCommentId: notification.relatedCommentId,
      });
      return;
    }

    // Follow bildirimleri
    if ((notification.type === 'follow' || notification.type === 'follow_request' || notification.type === 'follow_request_accepted') && notification.relatedUserId) {
      (navigation as any).navigate('UserProfile', { userId: notification.relatedUserId });
      return;
    }

    // Mesaj bildirimi: mümkünse direkt sohbet ekranına git
    if (notification.type === 'message') {
      if (notification.relatedConversationId && notification.relatedUserId) {
        try {
          const conversations = await getConversations();
          const convo = conversations.find(c => c.id === notification.relatedConversationId);
          if (convo) {
            (navigation as any).navigate('Chat', {
              conversationId: convo.id,
              otherUserId: convo.otherUserId,
              otherUserDisplayName: convo.otherUserDisplayName,
              otherUserAvatarUrl: convo.otherUserAvatarUrl || null,
            });
            return;
          }
        } catch {
          // Sessizce fallback
        }
      }
      (navigation as any).navigate('Inbox');
      return;
    }

    // Kredi bildirimi
    if (notification.type === 'ai_credit_charged') {
      (navigation as any).navigate('AICreditsDetail');
      return;
    }
  };

  const handleAcceptFollowRequest = async (notification: Notification) => {
    if (!notification.relatedFollowId) {
      toast.show({ type: 'error', message: t('follow.followRequestInfoNotFound') || 'Takip talebi bilgisi bulunamadı' });
      return;
    }
    
    try {
      await acceptFollowRequest(notification.relatedFollowId);
      toast.show({ type: 'success', message: t('follow.followRequestAccepted') });
      await handleMarkAsRead(notification.id);
      await loadNotifications(true, false); // Otomatik yenilemede hata gösterme
    } catch (error: any) {
      toast.show({ type: 'error', message: error.message || t('follow.error') });
    }
  };

  const handleRejectFollowRequest = async (notification: Notification) => {
    if (!notification.relatedFollowId) {
      toast.show({ type: 'error', message: t('follow.followRequestInfoNotFound') || 'Takip talebi bilgisi bulunamadı' });
      return;
    }
    
    try {
      await rejectFollowRequest(notification.relatedFollowId);
      toast.show({ type: 'success', message: t('follow.followRequestRejected') });
      await handleMarkAsRead(notification.id);
      await loadNotifications(true, false); // Otomatik yenilemede hata gösterme
    } catch (error: any) {
      toast.show({ type: 'error', message: error.message || t('follow.error') });
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const getIcon = () => {
      switch (item.type) {
        case 'comment':
          return 'chatbubble';
        case 'comment_like':
          return 'heart';
        case 'product_like':
          return 'heart';
        case 'message':
          return 'mail';
        case 'new_product':
          return 'pricetag';
        case 'ai_credit_charged':
          return 'sparkles';
        case 'follow':
          return 'person-add';
        case 'follow_request':
          return 'person-add-outline';
        case 'follow_request_accepted':
          return 'checkmark-circle';
        default:
          return 'notifications';
      }
    };

    const getIconColor = () => {
      switch (item.type) {
        case 'comment':
          return colors.primary;
        case 'comment_like':
          return '#e91e63';
        case 'product_like':
          return '#e91e63';
        case 'message':
          return '#2196F3';
        case 'new_product':
          return '#9C27B0';
        case 'ai_credit_charged':
          return '#FFB300';
        case 'follow':
          return '#4CAF50';
        case 'follow_request':
          return '#FF9800';
        case 'follow_request_accepted':
          return '#4CAF50';
        default:
          return colors.textMuted;
      }
    };

    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        style={{
          backgroundColor: item.isRead ? colors.surface : colors.primary + '10',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Icon */}
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: getIconColor() + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}>
            <Ionicons name={getIcon() as any} size={20} color={getIconColor()} />
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: colors.text, 
              fontWeight: item.isRead ? '500' : '700',
              fontSize: 15,
              marginBottom: 4,
            }}>
              {item.title}
            </Text>
            {item.message && (
              <Text style={{ 
                color: colors.textMuted, 
                fontSize: 14,
                marginBottom: 8,
                lineHeight: 20,
              }}>
                {item.message}
              </Text>
            )}
            <Text style={{ 
              color: colors.textMuted, 
              fontSize: 12,
            }}>
              {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Unread indicator */}
          {!item.isRead && (
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.primary,
              marginLeft: 8,
              marginTop: 6,
            }} />
          )}
        </View>

        {/* Follow Request Action Buttons */}
        {item.type === 'follow_request' && !item.isRead && item.relatedFollowId && (
          <View style={{ 
            flexDirection: 'row', 
            gap: 8, 
            marginTop: 12,
            marginLeft: 52,
          }}>
            <Pressable
              onPress={() => handleAcceptFollowRequest(item)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 16,
                backgroundColor: colors.primary,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
                {t('follow.accept')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleRejectFollowRequest(item)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 16,
                backgroundColor: colors.surface,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                {t('follow.reject')}
              </Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center',
      paddingVertical: 100,
    }}>
      <Ionicons name="notifications-outline" size={64} color={colors.textMuted} />
      <Text style={{ 
        color: colors.textMuted, 
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 8,
      }}>
        {t('notifications.noNotifications') || 'Henüz bildirim yok'}
      </Text>
      <Text style={{ 
        color: colors.textMuted, 
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
      }}>
        {t('notifications.noNotificationsDesc') || 'Yeni bildirimler burada görünecek'}
      </Text>
    </View>
  );

  const unreadCount = notifications.filter(n => !n.isRead).length;

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
          
          <Text style={{ 
            color: colors.text, 
            fontSize: 18, 
            fontWeight: '700',
            flex: 1,
          }}>
            {t('notifications.title') || 'Bildirimler'}
          </Text>

          {unreadCount > 0 && (
            <Pressable 
              onPress={handleMarkAllAsRead}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: colors.primary,
                borderRadius: 16,
              }}
            >
              <Text style={{ 
                color: 'white', 
                fontSize: 12,
                fontWeight: '600',
              }}>
                {t('notifications.markAllRead') || 'Tümünü okundu işaretle'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Expo Go bilgilendirme (push token uyarılarını kullanıcıya açıklamak için) */}
        {isExpoGo && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 8,
            padding: 14,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="information-circle" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
                  {t('notifications.pushExpoGoTitle') || 'Push bildirimleri (Expo Go)'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
                  {t('notifications.pushExpoGoDesc') ||
                    'Expo Go ve iOS simülatöründe push token alma kısıtlı olduğu için uyarılar görebilirsiniz. Push bildirimlerini test etmek için development build kullanacağız. Ayarlardan bildirim iznini istediğiniz zaman açıp kapatabilirsiniz.'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Notifications List */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh} 
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            contentContainerStyle={notifications.length === 0 ? { flex: 1 } : undefined}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

