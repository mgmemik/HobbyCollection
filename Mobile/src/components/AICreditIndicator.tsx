import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getUserBalance } from '../api/aiCredits';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

interface AICreditIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onPress?: () => void;
  refreshTrigger?: number; // Bu prop değiştiğinde bakiyeyi yeniden yükle
}

export const AICreditIndicator: React.FC<AICreditIndicatorProps> = ({ 
  size = 'medium', 
  showLabel = true,
  onPress,
  refreshTrigger = 0
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Size configurations
  const sizeConfig = {
    small: { iconSize: 16, fontSize: 12, padding: 4 },
    medium: { iconSize: 20, fontSize: 14, padding: 6 },
    large: { iconSize: 24, fontSize: 16, padding: 8 },
  };

  const config = sizeConfig[size];

  const loadBalance = async () => {
    try {
      setLoading(true);
      const userBalance = await getUserBalance();
      setBalance(userBalance);
    } catch (error) {
      console.error('Failed to load AI credits:', error);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalance();
    
    // Her 30 saniyede bir bakiyeyi güncelle
    const interval = setInterval(loadBalance, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // refreshTrigger değiştiğinde bakiyeyi yeniden yükle
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadBalance();
    }
  }, [refreshTrigger]);

  // Sayfa focus olduğunda bakiyeyi yeniden yükle
  useFocusEffect(
    useCallback(() => {
      loadBalance();
    }, [])
  );

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Varsayılan olarak AI Credits detay sayfasına git
      navigation.navigate('AICreditsDetail');
    }
  };

  if (loading) {
    return (
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: colors.surface,
        borderRadius: 16,
        paddingHorizontal: config.padding * 2,
        paddingVertical: config.padding,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const displayBalance = balance !== null ? balance : 0;
  const isLowCredit = displayBalance < 10;

  return (
    <Pressable 
      onPress={handlePress}
      style={({ pressed }) => ({ 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: isLowCredit ? 'rgba(255, 59, 48, 0.1)' : colors.surface,
        borderRadius: 16,
        paddingHorizontal: config.padding * 2,
        paddingVertical: config.padding,
        borderWidth: 1,
        borderColor: isLowCredit ? 'rgba(255, 59, 48, 0.3)' : colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* AI Sparkle Icon */}
      <Ionicons 
        name="sparkles" 
        size={config.iconSize} 
        color={isLowCredit ? '#FF3B30' : colors.primary}
        style={{ marginRight: 4 }} 
      />
      
      {/* Balance Text */}
      <Text style={{ 
        color: isLowCredit ? '#FF3B30' : colors.text,
        fontSize: config.fontSize,
        fontWeight: '600',
      }}>
        {displayBalance}
      </Text>
      
      {showLabel && (
        <Text style={{ 
          color: isLowCredit ? '#FF3B30' : colors.textSecondary,
          fontSize: config.fontSize - 2,
          fontWeight: '400',
          marginLeft: 2,
        }}>
          AI
        </Text>
      )}
    </Pressable>
  );
};

