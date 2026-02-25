import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../api/categories';
import { useTranslation } from 'react-i18next';

type Props = {
  categories: Category[];
  selectedCategory: string;
  onSelect: (category: string) => void;
  placeholder?: string;
};

export const CategorySelect: React.FC<Props> = ({ 
  categories, 
  selectedCategory, 
  onSelect, 
  placeholder = "Kategori seç" 
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const allCategories = [{ id: 'all', name: t('categories.allCategories') } as Category, ...categories];
  const displayText = selectedCategory || (placeholder || t('categories.selectCategory'));
  const isAllSelected = !selectedCategory;

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: colors.border,
          minWidth: 120,
        }}
      >
        <Ionicons name="filter" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
        <Text 
          style={{ 
            color: selectedCategory ? colors.text : colors.textMuted, 
            fontSize: 14,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {isAllSelected ? t('categories.allCategories') : selectedCategory}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable 
          style={{ 
            flex: 1, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            justifyContent: 'center',
            paddingHorizontal: 20,
          }}
          onPress={() => setIsOpen(false)}
        >
          <View 
            style={{ 
              backgroundColor: colors.surface, 
              borderRadius: 16,
              maxHeight: 400,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ 
              padding: 16, 
              borderBottomWidth: 1, 
              borderBottomColor: colors.border 
            }}>
              <Text style={{ 
                color: colors.text, 
                fontSize: 18, 
                fontWeight: '700',
                textAlign: 'center',
              }}>
                {t('categories.selectCategory')}
              </Text>
            </View>
            
            <FlatList
              data={allCategories}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => {
                const isSelected = (item.name === t('categories.allCategories') && !selectedCategory) || 
                                 (item.name === selectedCategory);
                
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.name === t('categories.allCategories') ? '' : item.name);
                      setIsOpen(false);
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      backgroundColor: isSelected ? colors.primary + '20' : 'transparent',
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border + '50',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ 
                        color: isSelected ? colors.primary : colors.text, 
                        fontSize: 16,
                        fontWeight: isSelected ? '600' : '400',
                        flex: 1,
                      }}>
                        {item.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={20} color={colors.primary} />
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

