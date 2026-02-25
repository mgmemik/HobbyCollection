import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { photoAnalysisAPI, PhotoAnalysisResult } from '../api/photoAnalysis';
import { useTheme } from '../theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

interface PhotoAnalyzerProps {
  onAnalysisComplete?: (result: PhotoAnalysisResult) => void;
  onSelectionChange?: (photos: { uri: string; name: string; type: string }[]) => void;
  maxPhotos?: number;
  compact?: boolean; // yalın görünüm: yalnızca butonlar
  enableAnalysis?: boolean; // AI analiz açık/kapalı
  onAnalyzingChange?: (isAnalyzing: boolean) => void; // analiz durumu callback
  useEnhancedAnalysis?: boolean; // Gelişmiş analiz kullanılsın mı?
  onEnhancedResult?: (result: any) => void; // Gelişmiş analiz sonucu callback
  clearTrigger?: number; // Bu değer değiştiğinde temizleme işlemi yapılır
  initialPhotos?: { uri: string; name?: string; type?: string }[]; // başlangıç fotoğrafları (ör. edit ekranı)
}

interface SelectedPhoto {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export const PhotoAnalyzer: React.FC<PhotoAnalyzerProps> = ({
  onAnalysisComplete,
  onSelectionChange,
  maxPhotos = 10,
  compact = false,
  enableAnalysis = true,
  onAnalyzingChange,
  useEnhancedAnalysis = false,
  onEnhancedResult,
  clearTrigger,
  initialPhotos
}) => {
  const { t } = useTranslation();
  const { colors, currentTheme } = useTheme();
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  // clearTrigger değiştiğinde temizleme işlemi yap
  useEffect(() => {
    if (clearTrigger !== undefined && clearTrigger > 0) {
      clearResults();
    }
  }, [clearTrigger]);


  // Başlangıç fotoğraflarını yükle (örn. edit ekranında mevcut fotoğraflar)
  useEffect(() => {
    if (initialPhotos && initialPhotos.length > 0 && selectedPhotos.length === 0) {
      const mapped: SelectedPhoto[] = initialPhotos.map((p, i) => ({
        uri: p.uri,
        name: p.name || `photo_${i}.jpg`,
        type: p.type || 'image/jpeg',
        size: 0,
      }));
      setSelectedPhotos(mapped);
      onSelectionChange?.(mapped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhotos]);


  // Yardımcı: verilen fotoğraflarla hemen analiz yap (compact mod için)
  // İzin yönetimi yardımcı fonksiyonu
  const checkAndRequestMediaLibraryPermission = async (): Promise<boolean> => {
    try {
      // Önce mevcut izin durumunu kontrol et
      const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      // Eğer izin zaten verilmişse, direkt true döndür
      if (currentPermission.granted) {
        return true;
      }
      
      // Eğer izin reddedilmişse ve tekrar istenemiyorsa, ayarlara yönlendir
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
      
      // İzin iste
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

  // Kamera izni yönetimi yardımcı fonksiyonu
  const checkAndRequestCameraPermission = async (): Promise<boolean> => {
    try {
      // Önce mevcut izin durumunu kontrol et
      const currentPermission = await ImagePicker.getCameraPermissionsAsync();
      
      // Eğer izin zaten verilmişse, direkt true döndür
      if (currentPermission.granted) {
        return true;
      }
      
      // Eğer izin reddedilmişse ve tekrar istenemiyorsa, ayarlara yönlendir
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
      
      // İzin iste
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

  // Fotoğraf seçimi
  const pickPhotos = async () => {
    setIsLoadingPhotos(true);
    try {
      // İzin kontrolü ve isteği
      const hasPermission = await checkAndRequestMediaLibraryPermission();
      if (!hasPermission) {
        setIsLoadingPhotos(false);
        return;
      }

      // Fotoğraf seç
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
        selectionLimit: maxPhotos - selectedPhotos.length,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // HEIC formatını JPEG'e dönüştür
        const processedPhotos = await Promise.all(
          result.assets.map(async (asset, index) => {
            try {
              // HEIC/HEIF formatı kontrolü
              const isHeic = asset.type?.toLowerCase().includes('heic') || 
                            asset.type?.toLowerCase().includes('heif') ||
                            asset.uri.toLowerCase().endsWith('.heic') ||
                            asset.uri.toLowerCase().endsWith('.heif');
              
              let finalUri = asset.uri;
              let finalType = asset.type || 'image/jpeg';
              
              // HEIC ise JPEG'e dönüştür
              if (isHeic) {
                try {
                  console.log(`HEIC formatı algılandı, JPEG'e dönüştürülüyor: ${asset.uri}`);
                  const manipulated = await ImageManipulator.manipulateAsync(
                    asset.uri,
                    [], // No transformations, just convert format
                    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
                  );
                  finalUri = manipulated.uri;
                  finalType = 'image/jpeg';
                  console.log(`HEIC JPEG'e dönüştürüldü: ${finalUri}`);
                } catch (error) {
                  console.error('HEIC dönüştürme hatası:', error);
                  Alert.alert(
                    t('common.error') || 'Format Hatası',
                    Platform.OS === 'ios'
                      ? 'iOS fotoğrafınız dönüştürülemedi. Lütfen iOS Ayarlar > Kamera > Formatlar > En Uyumlu seçeneğini seçin.'
                      : 'Fotoğraf formatı desteklenmiyor. Lütfen başka bir fotoğraf seçin.'
                  );
                  throw error;
                }
              }
              
              return {
                uri: finalUri,
                name: `photo_${Date.now()}_${index}.jpg`,
                type: finalType,
                size: asset.fileSize || 0,
              };
            } catch (error) {
              console.error(`Fotoğraf ${index} işleme hatası:`, error);
              // Tek bir fotoğraf hatası tüm işlemi durdurmasın, diğerlerini işlemeye devam et
              return null;
            }
          })
        );
        
        // Null değerleri filtrele
        const validPhotos = processedPhotos.filter((photo): photo is SelectedPhoto => photo !== null);
        
        if (validPhotos.length === 0) {
          Alert.alert(
            t('common.error') || 'Hata',
            'Seçilen fotoğraflar işlenemedi. Lütfen tekrar deneyin.'
          );
          setIsLoadingPhotos(false);
          return;
        }
        
        const newPhotos: SelectedPhoto[] = validPhotos;

        // Maksimum fotoğraf sayısı kontrolü
        const totalPhotos = selectedPhotos.length + newPhotos.length;
        if (totalPhotos > maxPhotos) {
          Alert.alert(
            t('common.error') || 'Çok Fazla Fotoğraf', 
            `En fazla ${maxPhotos} fotoğraf seçebilirsiniz. ${maxPhotos - selectedPhotos.length} fotoğraf daha ekleyebilirsiniz.`
          );
          setIsLoadingPhotos(false);
          return;
        }

        const updated = [...selectedPhotos, ...newPhotos];
        setSelectedPhotos(updated);
        onSelectionChange?.(updated);
        if (enableAnalysis && useEnhancedAnalysis) {
          await analyzePhotosEnhanced(updated);
        }
      }
    } catch (error: any) {
      console.error('Fotoğraf seçimi hatası:', error);
      const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
      
      // İzin hatası kontrolü
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
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Kameradan fotoğraf çek
  const takePhoto = async () => {
    setIsLoadingPhotos(true);
    try {
      // İzin kontrolü ve isteği
      const hasPermission = await checkAndRequestCameraPermission();
      if (!hasPermission) {
        setIsLoadingPhotos(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        try {
          const asset = result.assets[0];
          
          // HEIC formatını JPEG'e dönüştür
          let finalUri = asset.uri;
          let finalType = asset.type || 'image/jpeg';
          
          const isHeic = asset.type?.toLowerCase().includes('heic') || 
                        asset.type?.toLowerCase().includes('heif') ||
                        asset.uri.toLowerCase().endsWith('.heic') ||
                        asset.uri.toLowerCase().endsWith('.heif');
          
          if (isHeic) {
            try {
              console.log(`HEIC formatı algılandı (kamera), JPEG'e dönüştürülüyor: ${asset.uri}`);
              const manipulated = await ImageManipulator.manipulateAsync(
                asset.uri,
                [], // No transformations, just convert format
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
              );
              finalUri = manipulated.uri;
              finalType = 'image/jpeg';
              console.log(`HEIC JPEG'e dönüştürüldü: ${finalUri}`);
            } catch (error) {
              console.error('HEIC dönüştürme hatası:', error);
              Alert.alert(
                t('common.error') || 'Format Hatası',
                Platform.OS === 'ios'
                  ? 'iOS fotoğrafınız dönüştürülemedi. Lütfen iOS Ayarlar > Kamera > Formatlar > En Uyumlu seçeneğini seçin.'
                  : 'Fotoğraf formatı desteklenmiyor. Lütfen tekrar deneyin.'
              );
              throw error;
            }
          }
          
          const newPhoto: SelectedPhoto = {
            uri: finalUri,
            name: `camera_${Date.now()}.jpg`,
            type: finalType,
            size: asset.fileSize || 0,
          };

          if (selectedPhotos.length >= maxPhotos) {
            Alert.alert(
              t('common.error') || 'Maksimum Limit',
              `En fazla ${maxPhotos} fotoğraf ekleyebilirsiniz.`
            );
            setIsLoadingPhotos(false);
            return;
          }

          const updated = [...selectedPhotos, newPhoto];
          setSelectedPhotos(updated);
          onSelectionChange?.(updated);
          if (enableAnalysis && useEnhancedAnalysis) {
            await analyzePhotosEnhanced(updated);
          }
        } catch (error) {
          console.error('Fotoğraf işleme hatası:', error);
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Kamera hatası:', error);
      const errorMessage = error?.message || error?.toString() || 'Bilinmeyen hata';
      
      // İzin hatası kontrolü
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
      Alert.alert('Hata', 'Kamera kullanımı sırasında bir hata oluştu.');
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  // Fotoğraf kaldır
  const removePhoto = (index: number) => {
    const newPhotos = selectedPhotos.filter((_, i) => i !== index);
    setSelectedPhotos(newPhotos);
    onSelectionChange?.(newPhotos);
  };

  // Fotoğraf sırasını sola taşı (önceki pozisyona)
  const movePhotoLeft = (index: number) => {
    if (index === 0) return;
    const newPhotos = [...selectedPhotos];
    [newPhotos[index - 1], newPhotos[index]] = [newPhotos[index], newPhotos[index - 1]];
    setSelectedPhotos(newPhotos);
    onSelectionChange?.(newPhotos);
  };

  // Fotoğraf sırasını sağa taşı (sonraki pozisyona)
  const movePhotoRight = (index: number) => {
    if (index === selectedPhotos.length - 1) return;
    const newPhotos = [...selectedPhotos];
    [newPhotos[index], newPhotos[index + 1]] = [newPhotos[index + 1], newPhotos[index]];
    setSelectedPhotos(newPhotos);
    onSelectionChange?.(newPhotos);
  };

  // Gelişmiş analiz fonksiyonu
  const analyzePhotosEnhanced = async (photosOverride?: SelectedPhoto[]) => {
    if (!enableAnalysis) return;
    const photosToAnalyze = photosOverride ?? selectedPhotos;

    if (photosToAnalyze.length === 0) {
      Alert.alert('Hata', 'Lütfen en az bir fotoğraf seçin.');
      return;
    }

    setIsAnalyzing(true);
    onAnalyzingChange?.(true); // Parent'a bildir

    try {
      if (photosToAnalyze.length > maxPhotos) {
        Alert.alert('Hata', `En fazla ${maxPhotos} fotoğraf seçebilirsiniz.`);
        return;
      }

      // Dosya boyutu kontrolü
      const maxSize = 10 * 1024 * 1024; // 10MB
      for (const photo of photosToAnalyze) {
        if (photo.size > maxSize) {
          Alert.alert('Hata', `Dosya çok büyük: ${photo.name}. Maksimum 10MB olmalıdır.`);
          return;
        }
      }

      // AI dilini AsyncStorage'dan oku
      const aiLanguage = (await AsyncStorage.getItem('ai_lang')) || 'en';
      console.log('AI analiz dili:', aiLanguage);

      // Gelişmiş analiz yap (AI dili parametresi ile)
      const response = await photoAnalysisAPI.analyzePhotosEnhanced(photosToAnalyze as any, aiLanguage);

      if (response.success && response.result) {
        console.log('Gelişmiş analiz başarılı:', response.result);

        // Sonuçları normal analize dönüştür
        const convertedResult = {
          title: response.result.finalIdentification.productName || "Tanımlanamadı",
          description_tr: response.result.finalIdentification.reasoning || "",
          description_en: response.result.finalIdentification.reasoning || "",
          hashtags: response.result.hashtags || response.result.geminiHashtags || [], // Backend'den gelen hashtag'leri kullan
          entities: [
            {
              name: response.result.finalIdentification.brand,
              type: 'brand',
              confidence: response.result.finalIdentification.confidence
            }
          ].filter(e => e.name && e.name !== 'Electronic device'), // Boş entity'leri filtrele
          period: 'bilinmiyor',
          materials: ['belirlenemedi'],
          condition: 'belirlenemedi',
          rarity: 'belirlenemedi',
          confidence_overall: response.result.confidence || response.result.finalIdentification.confidence || 0,
          evidence: response.result.finalIdentification.evidence || [],
          visionData: response.result.dataCollection.visionResults[0] || null
        };

        onEnhancedResult?.(response.result); // Gelişmiş sonuç parent'a bildir
        onAnalysisComplete?.(convertedResult as any);
      } else {
        console.error('Gelişmiş analiz başarısız:', response);
        Alert.alert('Hata', response.message || 'Gelişmiş analiz başarısız');
      }
    } catch (error) {
      console.error('Gelişmiş analiz hatası:', error);
      Alert.alert('Hata', 'Gelişmiş analiz sırasında bir hata oluştu.');
    } finally {
      setIsAnalyzing(false);
      onAnalyzingChange?.(false);
    }
  };

  // Sonuçları temizle
  const clearResults = () => {
    setSelectedPhotos([]);
    onSelectionChange?.([]); // Parent'a boş array bildir
  };

  useEffect(() => {
    if (enableAnalysis && useEnhancedAnalysis && selectedPhotos.length > 0) {
      analyzePhotosEnhanced(selectedPhotos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableAnalysis, useEnhancedAnalysis]);


  return (
    <View style={styles.container}>
      {/* Fotoğraf Seçim Butonları */}
      <View style={[styles.buttonContainer, { backgroundColor: 'transparent' }]}>
        <TouchableOpacity 
          style={[styles.button, { 
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            opacity: isLoadingPhotos ? 0.6 : 1,
          }]} 
          onPress={takePhoto}
          disabled={isLoadingPhotos}
        >
          {isLoadingPhotos ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="camera" size={20} color="white" />
              <Text style={[styles.buttonText, { fontSize: 14 }]}>{t('addProduct.camera')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, { 
            backgroundColor: colors.accent,
            shadowColor: colors.accent,
            opacity: isLoadingPhotos ? 0.6 : 1,
          }]} 
          onPress={pickPhotos}
          disabled={isLoadingPhotos}
        >
          {isLoadingPhotos ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="images" size={20} color="white" />
              <Text style={[styles.buttonText, { fontSize: 14 }]}>{t('addProduct.gallery')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Seçilen Fotoğraflar (compact modda küçük satır) */}
      {selectedPhotos.length > 0 && (
        <View style={[
          compact ? styles.photosRowCompact : styles.photosSection,
          !compact && {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 16,
            marginTop: 8,
          }
        ]}>
          {!compact && (
            <View style={{ marginBottom: 8 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 2, color: colors.text }]}>
                {t('addProduct.selectedPhotos', { count: selectedPhotos.length, max: maxPhotos })}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 0 }}>
                {t('addProduct.reorderHint', 'Sıralamak için ok butonlarını kullanın')}
              </Text>
            </View>
          )}

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: compact ? 8 : 0 }}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {selectedPhotos.map((photo, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image 
                  source={{ uri: photo.uri }} 
                  style={[
                    compact ? styles.photoCompact : styles.photo,
                    compact && {
                      borderColor: colors.border,
                    }
                  ]}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={[styles.removeButton, compact && { 
                    top: -2, 
                    right: -2,
                    width: 20,
                    height: 20,
                    borderRadius: 10
                  }, { backgroundColor: colors.surface }]}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={compact ? 18 : 24} color="red" />
                </TouchableOpacity>
                
                {/* Sıralama butonları (compact modda gizle) */}
                {!compact && selectedPhotos.length > 1 && (
                  <View style={styles.reorderButtons}>
                    {index > 0 && (
                      <TouchableOpacity
                        style={[styles.reorderButton, { backgroundColor: colors.primary + 'CC' }]}
                        onPress={() => movePhotoLeft(index)}
                      >
                        <Ionicons name="chevron-back" size={16} color="white" />
                      </TouchableOpacity>
                    )}
                    {index < selectedPhotos.length - 1 && (
                      <TouchableOpacity
                        style={[styles.reorderButton, { backgroundColor: colors.primary + 'CC' }]}
                        onPress={() => movePhotoRight(index)}
                      >
                        <Ionicons name="chevron-forward" size={16} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

        </View>
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  photosSection: {
    // backgroundColor ve padding artık dinamik olarak uygulanıyor
    marginBottom: 10,
  },
  photosRowCompact: {
    marginTop: 0,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    // color artık dinamik olarak uygulanıyor
    marginBottom: 15,
  },
  photoContainer: {
    marginRight: 10,
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  photoCompact: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    // borderColor artık dinamik olarak uygulanıyor
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    // backgroundColor artık dinamik olarak uygulanıyor
    borderRadius: 12,
  },
  reorderButtons: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    gap: 4,
  },
  reorderButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  regularButton: {
    backgroundColor: '#34C759', // Yeşil - Normal analiz
  },
  enhancedButton: {
    backgroundColor: '#FF6B35', // Turuncu - Gelişmiş AI
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 48,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
  },
  resultsSection: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
  },
  resultCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  resultDescription: {
    fontSize: 16,
    color: '#555',
    lineHeight: 22,
    marginBottom: 15,
  },
  entitiesContainer: {
    marginBottom: 15,
  },
  entitiesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  entity: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  hashtagsContainer: {
    marginBottom: 15,
  },
  hashtagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  hashtags: {
    fontSize: 14,
    color: '#007AFF',
    lineHeight: 20,
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  confidence: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  period: {
    fontSize: 14,
    color: '#666',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
