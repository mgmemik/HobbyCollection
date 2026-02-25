import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getFollowers, getFollowing, FollowUser, followUser, unfollowUser, checkFollow, getPendingFollowRequests, PendingFollowRequest, acceptFollowRequest, rejectFollowRequest } from '../api/follows';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { base64Decode } from '../api/auth';

export const FollowListScreen: React.FC = () => {
  const { colors, currentTheme } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const { token } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, type } = route.params as { userId: string; type: 'followers' | 'following' };

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadUsers();
  }, [userId, type]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      if (type === 'pending') {
        // Bekleyen takip taleplerini yükle
        const response = await getPendingFollowRequests(1, 50);
        setPendingRequests(response.items);
        setHasMore(response.items.length < response.total);
        setLoading(false);
        return;
      }
      
      const response = type === 'followers' 
        ? await getFollowers(userId, 1, 50)
        : await getFollowing(userId, 1, 50);
      
      setUsers(response.items);
      setHasMore(response.items.length < response.total);
      
      // Her kullanıcı için takip durumunu kontrol et
      if (token) {
        const followChecks = await Promise.all(
          response.items.map(async (user) => {
            try {
              const check = await checkFollow(user.userId);
              return { userId: user.userId, isFollowing: check.isFollowing };
            } catch {
              return { userId: user.userId, isFollowing: false };
            }
          })
        );
        const map: Record<string, boolean> = {};
        followChecks.forEach(({ userId, isFollowing }) => {
          map[userId] = isFollowing;
        });
        setFollowingMap(map);
      }
    } catch (e: any) {
      toast.show({ type: 'error', message: t('follow.error'), subMessage: e?.message });
    } finally {
      setLoading(false);
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

  const handleAcceptRequest = async (followId: string) => {
    try {
      await acceptFollowRequest(followId);
      toast.show({ type: 'success', message: t('follow.followRequestAccepted') });
      await loadUsers();
    } catch (e: any) {
      toast.show({ type: 'error', message: e?.message || t('follow.error') });
    }
  };

  const handleRejectRequest = async (followId: string) => {
    try {
      await rejectFollowRequest(followId);
      toast.show({ type: 'success', message: t('follow.followRequestRejected') });
      await loadUsers();
    } catch (e: any) {
      toast.show({ type: 'error', message: e?.message || t('follow.error') });
    }
  };

  const renderUserItem = ({ item }: { item: FollowUser }) => {
    const isFollowing = followingMap[item.userId] || false;
    
    // Mevcut kullanıcı ID'sini al
    let isOwnProfile = false;
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = parts[1];
          const decodedStr = base64Decode(payload);
          const decoded = JSON.parse(decodedStr);
          const currentUserId = decoded.sub || decoded.nameid || decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || null;
          isOwnProfile = currentUserId === item.userId;
        }
      } catch (e) {
        console.error('Error decoding token:', e);
      }
    }
    
    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
          <Ionicons name="person" size={20} color={colors.primary} />
        </View>
        
        <Pressable
          onPress={() => {
            navigation.navigate('UserProfile', { userId: item.userId });
          }}
          style={{ flex: 1 }}
        >
          <Text style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: '600',
          }} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={{
            color: colors.textMuted,
            fontSize: 12,
          }} numberOfLines={1}>
            {item.email}
          </Text>
        </Pressable>

        {!isOwnProfile && token && (
          <Pressable
            onPress={() => handleFollowToggle(item.userId, isFollowing)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isFollowing ? colors.surface : colors.primary,
              borderWidth: 1,
              borderColor: isFollowing ? colors.border : colors.primary,
            }}
          >
            <Text style={{
              color: isFollowing ? colors.text : 'white',
              fontSize: 14,
              fontWeight: '600',
            }}>
              {isFollowing ? t('follow.unfollow') : t('follow.follow')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderPendingRequestItem = ({ item }: { item: PendingFollowRequest }) => (
    <View style={{
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.accent + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
          <Ionicons name="person-add-outline" size={20} color={colors.accent} />
        </View>
        
        <Pressable
          onPress={() => {
            navigation.navigate('UserProfile', { userId: item.userId });
          }}
          style={{ flex: 1 }}
        >
          <Text style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: '600',
          }} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={{
            color: colors.textMuted,
            fontSize: 12,
          }} numberOfLines={1}>
            {item.email}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => handleAcceptRequest(item.followId)}
          style={{
            flex: 1,
            paddingVertical: 8,
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
          onPress={() => handleRejectRequest(item.followId)}
          style={{
            flex: 1,
            paddingVertical: 8,
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
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
            {type === 'followers' 
              ? t('follow.followersList') 
              : type === 'following'
              ? t('follow.followingList')
              : t('follow.pendingRequests')}
          </Text>
        </View>

        {/* List */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : type === 'pending' && pendingRequests.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
            <Text style={{
              color: colors.textMuted,
              fontSize: 16,
              textAlign: 'center',
            }}>
              {t('follow.noPendingRequests')}
            </Text>
          </View>
        ) : type !== 'pending' && users.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
            <Text style={{
              color: colors.textMuted,
              fontSize: 16,
              textAlign: 'center',
            }}>
              {type === 'followers' ? t('follow.noFollowers') : t('follow.noFollowing')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={type === 'pending' ? pendingRequests : users}
            keyExtractor={(item) => type === 'pending' ? (item as PendingFollowRequest).followId : (item as FollowUser).userId}
            renderItem={type === 'pending' ? renderPendingRequestItem : renderUserItem}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

