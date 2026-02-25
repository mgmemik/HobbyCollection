import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Pressable,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getConversations, Conversation } from '../api/conversations';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { Image } from 'expo-image';
import { fixImageUrlForEmulator } from '../utils/imageUrl';

export const InboxScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await getConversations();
      setConversations(data);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      toast.show({ 
        type: 'error', 
        message: error.message || t('messages.error') || 'Mesajlar yüklenemedi' 
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, t]);

  useEffect(() => {
    loadConversations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    loadConversations(true);
  };

  const handleConversationPress = (conversation: Conversation) => {
    (navigation as any).navigate('Chat', { 
      conversationId: conversation.id,
      otherUserId: conversation.otherUserId,
      otherUserDisplayName: conversation.otherUserDisplayName,
      otherUserAvatarUrl: conversation.otherUserAvatarUrl || null,
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      const diffWeeks = Math.floor(diffMs / 604800000);
      const locale = i18n.language === 'tr' ? tr : enUS;

      if (diffMins < 1) return t('messages.justNow') || 'Şimdi';
      if (diffMins < 60) return `${diffMins}d`;
      if (diffHours < 24) return `${diffHours}s`;
      if (diffDays < 7) return `${diffDays}g`;
      if (diffWeeks < 5) return `${diffWeeks}h`;
      
      return format(date, 'd MMM', { locale });
    } catch {
      return '';
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const hasUnread = item.unreadCount > 0;
    
    return (
      <Pressable
        onPress={() => handleConversationPress(item)}
        style={({ pressed }) => [
          styles.conversationItem,
          { backgroundColor: pressed ? colors.border + '30' : colors.background }
        ]}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {item.otherUserAvatarUrl ? (
            <Image
              source={{ uri: fixImageUrlForEmulator(item.otherUserAvatarUrl) }}
              style={[styles.avatar, { backgroundColor: colors.border }]}
              contentFit="cover"
              transition={200}
              cachePolicy="disk"
              onError={(e) => console.warn('[InboxScreen] Avatar load error', e?.error)}
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {item.otherUserDisplayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
        
        {/* Content */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text 
              style={[
                styles.userName, 
                { 
                  color: colors.text,
                  fontWeight: hasUnread ? '600' : '400'
                }
              ]} 
              numberOfLines={1}
            >
              {item.otherUserDisplayName}
            </Text>
            {item.lastMessageAt && (
              <Text style={[styles.time, { color: colors.textMuted, fontWeight: hasUnread ? '600' : '400' }]}>
                {formatTime(item.lastMessageAt)}
              </Text>
            )}
          </View>
          
          <View style={styles.messagePreviewRow}>
            {item.lastMessage ? (
              <>
                {item.isLastMessageFromMe && (
                  <Text style={[styles.senderPrefix, { color: colors.textMuted }]}>
                    {t('messages.you') || 'Sen: '}
                  </Text>
                )}
                <Text 
                  style={[
                    styles.lastMessage, 
                    { 
                      color: hasUnread ? colors.text : colors.textMuted,
                      fontWeight: hasUnread ? '500' : '400'
                    }
                  ]} 
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </Text>
                {hasUnread && (
                  <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                )}
              </>
            ) : (
              <Text style={[styles.noMessage, { color: colors.textMuted }]}>
                {t('messages.noMessages') || 'Henüz mesaj yok'}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={80} color={colors.textMuted} style={{ opacity: 0.5 }} />
      <Text style={[styles.emptyText, { color: colors.text }]}>
        {t('messages.noConversations') || 'Henüz mesaj yok'}
      </Text>
      <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
        {t('messages.startConversation') || 'Bir kullanıcıyla mesajlaşmaya başlayın'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('messages.inbox') || 'Mesajlar'}
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={conversations.length === 0 ? styles.emptyListContainer : styles.listContent}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 88,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    flex: 1,
  },
  time: {
    fontSize: 14,
    marginLeft: 8,
  },
  messagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    marginRight: 4,
  },
  lastMessage: {
    fontSize: 15,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  noMessage: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyListContainer: {
    flexGrow: 1,
  },
});
