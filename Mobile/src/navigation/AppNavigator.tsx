import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme, Theme as NavTheme } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { TabNavigator } from './TabNavigator';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProductEditScreen } from '../screens/ProductEditScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { SavedProductsScreen } from '../screens/SavedProductsScreen';
import { CollectionReportScreen } from '../screens/CollectionReportScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { FollowListScreen } from '../screens/FollowListScreen';
import { AICreditsDetailScreen } from '../screens/AICreditsDetailScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { PlansScreen } from '../screens/PlansScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { AICreditsPolicyScreen } from '../screens/AICreditsPolicyScreen';
import { navigationRef, setNavigationReady } from './navigationRef';

export type RootStackParamList = {
  Main: undefined;
  ProductDetail: { productId: string; openComments?: boolean; focusCommentId?: string };
  Settings: undefined;
  ProductEdit: { productId: string };
  UserProfile: { userId: string };
  SavedProducts: undefined;
  CollectionReport: undefined;
  Notifications: undefined;
  FollowList: { userId: string; type: 'followers' | 'following' | 'pending' };
  AICreditsDetail: undefined;
  Inbox: undefined;
  Chat: { conversationId: string; otherUserId: string; otherUserDisplayName: string; otherUserAvatarUrl?: string | null };
  Plans: undefined;
  NotificationSettings: undefined;
  AICreditsPolicy: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { colors } = useTheme();

  const navTheme: NavTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer
      theme={navTheme}
      ref={navigationRef}
      onReady={() => {
        setNavigationReady();
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen 
          name="ProductDetail" 
          component={ProductDetailScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="ProductEdit" 
          component={ProductEditScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="UserProfile" 
          component={UserProfileScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="SavedProducts" 
          component={SavedProductsScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="CollectionReport" 
          component={CollectionReportScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="Notifications" 
          component={NotificationsScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="FollowList" 
          component={FollowListScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="AICreditsDetail" 
          component={AICreditsDetailScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="Inbox" 
          component={InboxScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="Plans" 
          component={PlansScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="NotificationSettings" 
          component={NotificationSettingsScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
        <Stack.Screen 
          name="AICreditsPolicy" 
          component={AICreditsPolicyScreen}
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
