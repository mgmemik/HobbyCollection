import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { AddScreen } from '../screens/AddScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';

const Tab = createBottomTabNavigator();

const Placeholder: React.FC<{ title: string }> = ({ title }) => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Text style={{ color: colors.text }}>{title}</Text>
    </View>
  );
};

export const TabNavigator: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const getTabLabel = (routeName: string): string => {
    const labelMap: Record<string, string> = {
      Home: t('navigation.home'),
      Search: t('navigation.search'),
      Add: t('navigation.add'),
      Profile: t('navigation.profile'),
    };
    return labelMap[routeName] || routeName;
  };

  return (
    <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.text,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabel: getTabLabel(route.name),
          tabBarIcon: ({ color, size }) => {
            const map: Record<string, keyof typeof Ionicons.glyphMap> = {
              Home: 'home',
              Search: 'search',
              Add: 'add-circle',
              Profile: 'person',
            };
            const name = map[route.name] || 'ellipse';
            return <Ionicons name={name} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Search" component={SearchScreen} />
        <Tab.Screen name="Add" component={AddScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
  );
};
