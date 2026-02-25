import React, { useState } from 'react';
import { View, Image, Pressable, Text, FlatList, Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { Button } from './ui/Button';
import { useTranslation } from 'react-i18next';

type Picked = { uri: string };

export const PhotoPicker: React.FC<{ max?: number; onChange?: (items: Picked[]) => void }> = ({ max = 10, onChange }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [items, setItems] = useState<Picked[]>([]);

  const sync = (next: Picked[]) => {
    setItems(next);
    onChange?.(next);
  };

  const checkAndRequestMediaLibraryPermission = async (): Promise<boolean> => {
    try {
      const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      if (currentPermission.granted) {
        return true;
      }
      
      if (currentPermission.status === 'denied' && !currentPermission.canAskAgain) {
        Alert.alert(
          t('addProduct.permissionRequired'),
          t('addProduct.galleryPermissionMessage') + '\n\n' + (Platform.OS === 'ios' 
            ? 'Lütfen Ayarlar > Save All > Fotoğraflar iznini açın.'
            : 'Lütfen Ayarlar > Uygulamalar > Save All > İzinler > Depolama iznini açın.'),
          [
            { text: t('common.cancel') || 'İptal', style: 'cancel' },
            { 
              text: t('common.settings') || 'Ayarlar', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return false;
      }
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        if (permissionResult.status === 'denied' && !permissionResult.canAskAgain) {
          Alert.alert(
            t('addProduct.permissionRequired'),
            t('addProduct.galleryPermissionMessage') + '\n\n' + (Platform.OS === 'ios'
              ? 'Lütfen Ayarlar > Save All > Fotoğraflar iznini açın.'
              : 'Lütfen Ayarlar > Uygulamalar > Save All > İzinler > Depolama iznini açın.'),
            [
              { text: t('common.cancel') || 'İptal', style: 'cancel' },
              { 
                text: t('common.settings') || 'Ayarlar', 
                onPress: () => Linking.openSettings() 
              }
            ]
          );
        } else {
          Alert.alert(
            t('addProduct.permissionRequired'),
            t('addProduct.galleryPermissionMessage')
          );
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('İzin kontrolü hatası:', error);
      Alert.alert(
        t('common.error') || 'Hata',
        t('addProduct.galleryPermissionMessage') || 'Galeri erişim izni gereklidir.'
      );
      return false;
    }
  };

  const checkAndRequestCameraPermission = async (): Promise<boolean> => {
    try {
      const currentPermission = await ImagePicker.getCameraPermissionsAsync();
      
      if (currentPermission.granted) {
        return true;
      }
      
      if (currentPermission.status === 'denied' && !currentPermission.canAskAgain) {
        Alert.alert(
          t('addProduct.permissionRequired'),
          t('addProduct.cameraPermissionMessage') + '\n\n' + (Platform.OS === 'ios'
            ? 'Lütfen Ayarlar > Save All > Kamera iznini açın.'
            : 'Lütfen Ayarlar > Uygulamalar > Save All > İzinler > Kamera iznini açın.'),
          [
            { text: t('common.cancel') || 'İptal', style: 'cancel' },
            { 
              text: t('common.settings') || 'Ayarlar', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return false;
      }
      
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        if (permissionResult.status === 'denied' && !permissionResult.canAskAgain) {
          Alert.alert(
            t('addProduct.permissionRequired'),
            t('addProduct.cameraPermissionMessage') + '\n\n' + (Platform.OS === 'ios'
              ? 'Lütfen Ayarlar > Save All > Kamera iznini açın.'
              : 'Lütfen Ayarlar > Uygulamalar > Save All > İzinler > Kamera iznini açın.'),
            [
              { text: t('common.cancel') || 'İptal', style: 'cancel' },
              { 
                text: t('common.settings') || 'Ayarlar', 
                onPress: () => Linking.openSettings() 
              }
            ]
          );
        } else {
          Alert.alert(
            t('addProduct.permissionRequired'),
            t('addProduct.cameraPermissionMessage')
          );
        }
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Kamera izin kontrolü hatası:', error);
      Alert.alert(
        t('common.error') || 'Hata',
        t('addProduct.cameraPermissionMessage') || 'Kamera erişim izni gereklidir.'
      );
      return false;
    }
  };

  const pickFromLibrary = async () => {
    try {
      const ok = await checkAndRequestMediaLibraryPermission();
      if (!ok) return;
      
      const selectionLimit = typeof max === 'number' ? max : Number(max) || 10;
      const result = await ImagePicker.launchImageLibraryAsync({ 
        allowsMultipleSelection: true, 
        quality: 0.8, 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        selectionLimit: selectionLimit 
      });
      
      if (!result.canceled && result.assets) {
        const next = [...items, ...result.assets.map(a => ({ uri: a.uri }))].slice(0, max);
        sync(next);
      }
    } catch (error: any) {
      console.error('Fotoğraf seçimi hatası:', error);
      const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
      
      if (errorMessage.includes('permission') || errorMessage.includes('Permission') || errorMessage.includes('izin')) {
        Alert.alert(
          t('addProduct.permissionRequired'),
          t('addProduct.galleryPermissionMessage') + '\n\n' + (Platform.OS === 'ios'
            ? 'Lütfen Ayarlar > Save All > Fotoğraflar iznini açın.'
            : 'Lütfen Ayarlar > Uygulamalar > Save All > İzinler > Depolama iznini açın.'),
          [
            { text: t('common.cancel') || 'İptal', style: 'cancel' },
            { 
              text: t('common.settings') || 'Ayarlar', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
      } else {
        Alert.alert(
          t('common.error') || 'Hata',
          t('addProduct.photoSelectionError') || `Fotoğraf seçimi sırasında bir hata oluştu: ${errorMessage}`
        );
      }
    }
  };

  const takePhoto = async () => {
    try {
      const ok = await checkAndRequestCameraPermission();
      if (!ok) return;
      
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const next = [...items, { uri: result.assets[0].uri }].slice(0, max);
        sync(next);
      }
    } catch (error: any) {
      console.error('Kamera hatası:', error);
      const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
      
      if (errorMessage.includes('permission') || errorMessage.includes('Permission') || errorMessage.includes('izin')) {
        Alert.alert(
          t('addProduct.permissionRequired'),
          t('addProduct.cameraPermissionMessage') + '\n\n' + (Platform.OS === 'ios'
            ? 'Lütfen Ayarlar > Save All > Kamera iznini açın.'
            : 'Lütfen Ayarlar > Uygulamalar > Save All > İzinler > Kamera iznini açın.'),
          [
            { text: t('common.cancel') || 'İptal', style: 'cancel' },
            { 
              text: t('common.settings') || 'Ayarlar', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
      } else {
        Alert.alert(
          t('common.error') || 'Hata',
          t('addProduct.cameraError') || `Kamera kullanımı sırasında bir hata oluştu: ${errorMessage}`
        );
      }
    }
  };

  const removeAt = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    sync(next);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title={t('addProduct.selectFromGallery')} onPress={pickFromLibrary} />
        <Button title={t('addProduct.takePhoto')} onPress={takePhoto} variant="outline" />
      </View>
      <Text style={{ color: colors.text, marginTop: 8 }}>{t('addProduct.photoCount', { count: items.length, max })}</Text>
      <FlatList
        data={items}
        horizontal
        keyExtractor={(it, idx) => it.uri + idx}
        style={{ marginTop: 8 }}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item, index }) => (
          <Pressable onLongPress={() => removeAt(index)}>
            <Image source={{ uri: item.uri }} style={{ width: 96, height: 96, borderRadius: 8, borderWidth: 1, borderColor: colors.border }} />
          </Pressable>
        )}
      />
    </View>
  );
};


