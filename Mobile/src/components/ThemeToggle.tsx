import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { currentTheme, toggleTheme, colors } = useTheme();
  const activeStyle = { backgroundColor: colors.primary, borderColor: colors.primary };
  const inactiveStyle = { backgroundColor: 'transparent', borderColor: colors.border };
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Pressable onPress={() => currentTheme === 'dark' && toggleTheme()}
        style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, currentTheme === 'light' ? activeStyle : inactiveStyle, pressed ? { opacity: 0.8 } : null ]}>
        <Ionicons name="sunny" size={18} color={currentTheme === 'light' ? '#fff' : colors.text} />
      </Pressable>
      <Pressable onPress={() => currentTheme === 'light' && toggleTheme()}
        style={({ pressed }) => [{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, currentTheme === 'dark' ? activeStyle : inactiveStyle, pressed ? { opacity: 0.8 } : null ]}>
        <Ionicons name="moon" size={18} color={currentTheme === 'dark' ? '#fff' : colors.text} />
      </Pressable>
    </View>
  );
};


