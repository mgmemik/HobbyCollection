import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, FlatList, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Category, fetchRoots, fetchChildren } from '../api/categories';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (path: Category[]) => void;
  initialPath?: Category[] | null;
};

export const CategoryPicker: React.FC<Props> = ({ visible, onClose, onSelect, initialPath }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [levels, setLevels] = useState<Category[][]>([]);
  const [path, setPath] = useState<Category[]>([]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const roots = await fetchRoots();
      
      // Eğer initialPath varsa, o path'i yükle
      if (initialPath && initialPath.length > 0) {
        const loadedLevels: Category[][] = [roots];
        let currentPath: Category[] = [];
        
        // Her seviyeyi sırayla yükle
        for (let i = 0; i < initialPath.length; i++) {
          const category = initialPath[i];
          currentPath = [...currentPath, category];
          
          // Eğer son kategori değilse, children'ları yükle
          if (i < initialPath.length - 1) {
            const children = await fetchChildren(category.id);
            loadedLevels.push(children);
          }
        }
        
        setLevels(loadedLevels);
        setPath(currentPath);
      } else {
        // Initial path yoksa, normal şekilde başlat
        setLevels([roots]);
        setPath([]);
      }
    })();
  }, [visible, initialPath]);

  const pick = async (levelIndex: number, item: Category) => {
    const newPath = [...path.slice(0, levelIndex), item];
    setPath(newPath);
    const children = await fetchChildren(item.id);
    if (children.length > 0) {
      setLevels([...levels.slice(0, levelIndex + 1), children]);
    } else {
      onSelect(newPath);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'android' ? 16 : 0,
          paddingBottom: 16,
        }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{t('categories.selectCategory')}</Text>
          <Pressable onPress={onClose}><Text style={{ color: colors.primary }}>{t('common.close')}</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', flex: 1 }}>
          {levels.map((items, idx) => {
            // Bu seviyede seçili kategori var mı?
            const selectedCategory = path[idx];
            const isSelected = (item: Category) => selectedCategory && selectedCategory.id === item.id;
            
            return (
              <FlatList
                key={idx}
                data={items}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => {
                  const selected = isSelected(item);
                  return (
                    <Pressable 
                      onPress={() => pick(idx, item)} 
                      style={{ 
                        padding: 12, 
                        borderRadius: 10, 
                        backgroundColor: selected ? colors.primary + '20' : colors.surface, 
                        borderWidth: 1, 
                        borderColor: selected ? colors.primary : colors.border 
                      }}
                    >
                      <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: selected ? '600' : '400' }}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            );
          })}
        </View>
        {path.length > 0 && (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.text }}>{t('categories.selection')}: {path.map(p => p.name).join(' / ')}</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};


