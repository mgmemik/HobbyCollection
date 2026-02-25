import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput,
  Pressable,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getMessages, sendMessage, markMessagesAsRead, deleteMessage, Message, MessageType } from '../api/messages';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { deleteConversation } from '../api/conversations';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { Image } from 'expo-image';
import { fixImageUrlForEmulator } from '../utils/imageUrl';

export const ChatScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute();
  const { conversationId, otherUserId, otherUserDisplayName, otherUserAvatarUrl } = route.params as { 
    conversationId: string;
    otherUserId: string;
    otherUserDisplayName: string;
    otherUserAvatarUrl?: string | null;
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getMessages(conversationId, 1, 100);
      setMessages(response.messages);
      
      // Mesajları okundu olarak işaretle
      if (response.messages.some(m => !m.isRead && !m.isFromMe)) {
        await markMessagesAsRead(conversationId);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast.show({ 
        type: 'error', 
        message: error.message || t('messages.loadError') || 'Mesajlar yüklenemedi' 
      });
    } finally {
      setLoading(false);
    }
  }, [conversationId, toast, t]);

  useEffect(() => {
    loadMessages();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages])
  );

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const newMessage = await sendMessage(conversationId, text, MessageType.Text);
      const formattedMessage: Message = {
        ...newMessage,
        senderDisplayName: otherUserDisplayName,
        isFromMe: true,
      };
      setMessages(prev => [...prev, formattedMessage]);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.show({ 
        type: 'error', 
        message: error.message || t('messages.sendError') || 'Mesaj gönderilemedi' 
      });
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const locale = i18n.language === 'tr' ? tr : enUS;
      return format(date, 'HH:mm', { locale });
    } catch {
      return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      const locale = i18n.language === 'tr' ? tr : enUS;
      
      if (diffDays === 0) return t('messages.today') || 'Bugün';
      if (diffDays === 1) return t('messages.yesterday') || 'Dün';
      return format(date, 'd MMMM', { locale });
    } catch {
      return dateString;
    }
  };

  const handleMessagePress = (message: Message) => {
    setSelectedMessage(message);
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    
    const messageId = selectedMessage.id;
    setSelectedMessage(null);
    
    Alert.alert(
      t('messages.deleteMessage') || 'Mesajı Sil',
      t('messages.deleteConfirm') || 'Bu mesajı silmek istediğinize emin misiniz?',
      [
        {
          text: t('common.cancel') || 'İptal',
          style: 'cancel',
        },
        {
          text: t('common.delete') || 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(messageId);
              setMessages(prev => prev.filter(m => m.id !== messageId));
              toast.show({
                type: 'success',
                message: t('messages.deleted') || 'Mesaj silindi',
              });
            } catch (error: any) {
              toast.show({
                type: 'error',
                message: error.message || t('messages.deleteError') || 'Mesaj silinemedi',
              });
            }
          },
        },
      ]
    );
  };

  const handleDeleteConversation = async () => {
    setMenuOpen(false);
    
    Alert.alert(
      t('messages.deleteConversation') || 'Konuşmayı Sil',
      t('messages.deleteConversationConfirm') || 'Bu konuşmayı silmek istediğinize emin misiniz? Tüm mesajlar silinecek.',
      [
        {
          text: t('common.cancel') || 'İptal',
          style: 'cancel',
        },
        {
          text: t('common.delete') || 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(conversationId);
              toast.show({
                type: 'success',
                message: t('messages.conversationDeleted') || 'Konuşma silindi',
              });
              navigation.goBack();
            } catch (error: any) {
              toast.show({
                type: 'error',
                message: error.message || t('messages.deleteConversationError') || 'Konuşma silinemedi',
              });
            }
          },
        },
      ]
    );
  };

  const shouldShowDateSeparator = (currentMsg: Message, previousMsg: Message | null) => {
    if (!previousMsg) return true;
    const current = new Date(currentMsg.createdAt);
    const previous = new Date(previousMsg.createdAt);
    return current.toDateString() !== previous.toDateString();
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.isFromMe;
    const previousMsg = index > 0 ? messages[index - 1] : null;
    const showDate = shouldShowDateSeparator(item, previousMsg);
    
    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
        )}
        <Pressable onPress={() => handleMessagePress(item)}>
          <View style={[
            styles.messageContainer, 
            isMe ? styles.messageRight : styles.messageLeft
          ]}>
            {/* Avatar - Karşıdan gelen mesajlar için sol tarafta */}
            {!isMe && (
              <View style={{ marginRight: 8 }}>
                {item.senderAvatarUrl || otherUserAvatarUrl ? (
                  <Image
                    source={{ uri: fixImageUrlForEmulator((item.senderAvatarUrl || otherUserAvatarUrl) as string) }}
                    style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border }}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="disk"
                  />
                ) : (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      {(otherUserDisplayName || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Mesaj balonu */}
            <View style={{ maxWidth: '75%' }}>
              <View style={[
                styles.messageBubble,
                {
                  backgroundColor: isMe ? colors.primary : colors.surface,
                }
              ]}>
                <Text style={[
                  styles.messageText,
                  { color: isMe ? '#FFFFFF' : colors.text }
                ]}>
                  {item.content}
                </Text>
              </View>
              <View style={[styles.messageFooter, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
                <Text style={[
                  styles.messageTime,
                  { color: colors.textMuted }
                ]}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && (
                  <Ionicons 
                    name={item.isRead ? "checkmark-done" : "checkmark"} 
                    size={14} 
                    color={item.isRead ? colors.primary : colors.textMuted} 
                    style={styles.readIcon}
                  />
                )}
              </View>
            </View>
            
            {/* Avatar - Kendi mesajlarım için sağ tarafta (opsiyonel, genelde gösterilmez) */}
            {isMe && false && (
              <View style={{ marginLeft: 8 }}>
                {/* Kendi avatarımızı göstermek istersek buraya ekleyebiliriz */}
              </View>
            )}
          </View>
        </Pressable>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={currentTheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        
        <Pressable 
          style={styles.headerCenter}
          onPress={() => {
            if (otherUserId) {
              (navigation as any).navigate('UserProfile', { userId: otherUserId });
            }
          }}
        >
          {otherUserAvatarUrl ? (
            <Image
              source={{ uri: fixImageUrlForEmulator(otherUserAvatarUrl) }}
              style={[styles.headerAvatar, { backgroundColor: colors.border }]}
              contentFit="cover"
              transition={200}
              cachePolicy="disk"
            />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
                {(otherUserDisplayName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {otherUserDisplayName || 'User'}
          </Text>
        </Pressable>
        
        <Pressable
          onPress={() => setMenuOpen(!menuOpen)}
          style={styles.menuButton}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView 
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.emptyAvatarText, { color: colors.primary }]}>
                    {(otherUserDisplayName || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {otherUserDisplayName || 'User'}
                </Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {t('messages.startConversation') || 'İlk mesajınızı gönderin'}
                </Text>
              </View>
            }
          />

          {/* Input Area */}
          <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={messageText}
                onChangeText={setMessageText}
                placeholder={t('messages.typeMessage') || 'Mesaj...'}
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={1000}
                editable={!sending}
              />
            </View>
            
            <Pressable
              onPress={handleSend}
              disabled={!messageText.trim() || sending}
              style={[
                styles.sendButton, 
                { 
                  backgroundColor: messageText.trim() ? colors.primary : colors.surface,
                  opacity: (!messageText.trim() || sending) ? 0.5 : 1,
                  borderWidth: messageText.trim() ? 0 : 1,
                  borderColor: colors.border,
                }
              ]}
            >
              {sending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Ionicons 
                  name="send" 
                  size={18} 
                  color={messageText.trim() ? "white" : colors.textMuted} 
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Message Action Sheet */}
      <Modal
        visible={selectedMessage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable 
          style={styles.actionSheetBackdrop}
          onPress={() => setSelectedMessage(null)}
        >
          <View style={[styles.actionSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={handleDeleteMessage}
              style={styles.actionSheetItem}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4444" style={styles.actionSheetIcon} />
              <Text style={[styles.actionSheetText, { color: '#ff4444' }]}>
                {t('messages.deleteMessage') || 'Mesajı Sil'}
              </Text>
            </Pressable>
            <View style={[styles.actionSheetSeparator, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={() => setSelectedMessage(null)}
              style={styles.actionSheetItem}
            >
              <Text style={[styles.actionSheetText, { color: colors.text }]}>
                {t('common.cancel') || 'İptal'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Conversation Menu */}
      {menuOpen && (
        <>
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuOpen(false)}
          />
          <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={handleDeleteConversation}
              style={styles.menuItem}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4444" style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: '#ff4444' }]}>
                {t('messages.deleteConversation') || 'Konuşmayı Sil'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    position: 'absolute',
    top: 60,
    right: 8,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '400',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageContainer: {
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageLeft: {
    alignSelf: 'flex-start',
  },
  messageRight: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginHorizontal: 8,
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  readIcon: {
    marginLeft: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyAvatarText: {
    fontSize: 32,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    minHeight: 40,
    maxHeight: 120,
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 20,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionSheetIcon: {
    marginRight: 12,
  },
  actionSheetText: {
    fontSize: 18,
    fontWeight: '400',
  },
  actionSheetSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
});
