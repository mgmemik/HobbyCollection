import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export enum ProductBadgeType {
  None = 0,
  Hot = 1,        // 🔥 Popüler
  New = 2,        // ✨ Yeni
  Rare = 3,       // 💎 Nadir
  Mint = 4,       // ⭐ Mint
  Graded = 5,     // 🎖️ Puanlanmış
  Signed = 6,     // ✍️ İmzalı
  Limited = 7,    // 🔖 Sınırlı
  Featured = 8,   // 👑 Öne Çıkan
  Trending = 9    // 📈 Trend
}

interface BadgeConfig {
  emoji: string;
  text: string;
  colors: string[];
  textColor: string;
}

const BADGE_CONFIGS: Record<ProductBadgeType, BadgeConfig> = {
  [ProductBadgeType.None]: { emoji: '', text: '', colors: [], textColor: '#000' },
  [ProductBadgeType.Hot]: { 
    emoji: '🔥', 
    text: 'HOT', 
    colors: ['#FF6B6B', '#FF8E53'],
    textColor: '#FFFFFF'
  },
  [ProductBadgeType.New]: { 
    emoji: '✨', 
    text: 'NEW', 
    colors: ['#4ECDC4', '#44A08D'],
    textColor: '#FFFFFF'
  },
  [ProductBadgeType.Rare]: { 
    emoji: '💎', 
    text: 'RARE', 
    colors: ['#667EEA', '#764BA2'],
    textColor: '#FFFFFF'
  },
  [ProductBadgeType.Mint]: { 
    emoji: '⭐', 
    text: 'MINT', 
    colors: ['#FFD93D', '#F6B93B'],
    textColor: '#1A1A1A'
  },
  [ProductBadgeType.Graded]: { 
    emoji: '🎖️', 
    text: 'GRADED', 
    colors: ['#C471ED', '#F64F59'],
    textColor: '#FFFFFF'
  },
  [ProductBadgeType.Signed]: { 
    emoji: '✍️', 
    text: 'SIGNED', 
    colors: ['#F093FB', '#F5576C'],
    textColor: '#FFFFFF'
  },
  [ProductBadgeType.Limited]: { 
    emoji: '🔖', 
    text: 'LIMITED', 
    colors: ['#FA709A', '#FEE140'],
    textColor: '#1A1A1A'
  },
  [ProductBadgeType.Featured]: { 
    emoji: '👑', 
    text: 'FEATURED', 
    colors: ['#FFD700', '#FFA500'],
    textColor: '#1A1A1A'
  },
  [ProductBadgeType.Trending]: { 
    emoji: '📈', 
    text: 'TRENDING', 
    colors: ['#FF6B9D', '#C06C84'],
    textColor: '#FFFFFF'
  },
};

interface ProductBadgeProps {
  type: ProductBadgeType;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const ProductBadge: React.FC<ProductBadgeProps> = ({ 
  type, 
  size = 'medium',
  showText = true,
  position = 'top-right'
}) => {
  if (type === ProductBadgeType.None) return null;

  const config = BADGE_CONFIGS[type];
  
  const sizeConfig = {
    small: { 
      paddingHorizontal: 6, 
      paddingVertical: 3, 
      fontSize: 10, 
      emojiSize: 12,
      borderRadius: 8,
      minWidth: 40
    },
    medium: { 
      paddingHorizontal: 8, 
      paddingVertical: 4, 
      fontSize: 11, 
      emojiSize: 14,
      borderRadius: 10,
      minWidth: 50
    },
    large: { 
      paddingHorizontal: 10, 
      paddingVertical: 5, 
      fontSize: 12, 
      emojiSize: 16,
      borderRadius: 12,
      minWidth: 60
    },
  }[size];

  const positionStyle = {
    'top-left': { top: 4, left: 4 },
    'top-right': { top: 4, right: 4 },
    'bottom-left': { bottom: 4, left: 4 },
    'bottom-right': { bottom: 4, right: 4 },
  }[position];

  return (
    <View style={[styles.container, positionStyle]}>
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.badge,
          { 
            paddingHorizontal: sizeConfig.paddingHorizontal,
            paddingVertical: sizeConfig.paddingVertical,
            borderRadius: sizeConfig.borderRadius,
            minWidth: sizeConfig.minWidth
          }
        ]}
      >
        <Text style={{ fontSize: sizeConfig.emojiSize }}>{config.emoji}</Text>
        {showText && (
          <Text style={[
            styles.text, 
            { 
              color: config.textColor,
              fontSize: sizeConfig.fontSize,
              marginLeft: 4
            }
          ]}>
            {config.text}
          </Text>
        )}
      </LinearGradient>
    </View>
  );
};

interface ProductBadgesProps {
  badges: ProductBadgeType[];
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  maxBadges?: number;
}

/**
 * Birden fazla badge göstermek için wrapper component
 * En fazla maxBadges kadar badge gösterir, öncelik sırasına göre
 */
export const ProductBadges: React.FC<ProductBadgesProps> = ({ 
  badges, 
  size = 'small',
  showText = false,
  position = 'top-right',
  maxBadges = 2
}) => {
  if (!badges || badges.length === 0) return null;

  // Badge öncelik sırası (önemli olanlar önce)
  const priorityOrder = [
    ProductBadgeType.Featured,
    ProductBadgeType.Hot,
    ProductBadgeType.Trending,
    ProductBadgeType.New,
    ProductBadgeType.Rare,
    ProductBadgeType.Graded,
    ProductBadgeType.Signed,
    ProductBadgeType.Limited,
    ProductBadgeType.Mint,
  ];

  // Öncelik sırasına göre sırala ve ilk maxBadges'i al
  const sortedBadges = badges
    .filter(b => b !== ProductBadgeType.None)
    .sort((a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b))
    .slice(0, maxBadges);

  if (sortedBadges.length === 0) return null;

  // Pozisyona göre flex direction belirle
  const isLeft = position.includes('left');
  const isTop = position.includes('top');
  
  const containerStyle = {
    position: 'absolute' as const,
    [isTop ? 'top' : 'bottom']: 4,
    [isLeft ? 'left' : 'right']: 4,
    flexDirection: 'column' as const,
    gap: 4,
    alignItems: isLeft ? 'flex-start' : 'flex-end',
  };

  return (
    <View style={containerStyle}>
      {sortedBadges.map((badge, index) => (
        <ProductBadge 
          key={`${badge}-${index}`}
          type={badge}
          size={size}
          showText={showText}
          position={position}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

