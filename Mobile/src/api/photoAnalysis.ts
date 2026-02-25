import { API_BASE_URL } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import axios from 'axios';

// API Response Types
export interface PhotoAnalysisResponse {
  success: boolean;
  message: string;
  result?: PhotoAnalysisResult;
}

// Gelişmiş analiz için yeni response tipi
export interface EnhancedAnalysisResponse {
  success: boolean;
  message: string;
  result?: EnhancedAnalysisResult;
}

export interface EnhancedAnalysisResult {
  dataCollection: AnalysisDataCollection;
  finalIdentification: ProductIdentificationResult;
  confidence: number;
  processingTime: number;
}

export interface AnalysisDataCollection {
  visionResults: VisionAnalysisData[];
  ocrText: string;
  webSearchResults: SerpResult[];
}

export interface ProductIdentificationResult {
  productName: string;
  brand: string;
  model: string;
  confidence: number;
  reasoning: string;
  evidence: string[];
}

export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}


export interface PhotoAnalysisResult {
  title: string;
  description_tr: string;
  description_en: string;
  hashtags: string[];
  entities: DetectedEntity[];
  period: string;
  materials: string[];
  condition: string;
  rarity: string;
  confidence_overall: number;
  evidence: string[];
  visionData?: VisionAnalysisData;
}

export interface DetectedEntity {
  name: string;
  type: string;
  confidence: number;
}

export interface VisionAnalysisData {
  labels: LabelInfo[];
  webEntities: WebEntity[];
  objects: ObjectInfo[];
  extractedText: string;
}

export interface LabelInfo {
  description: string;
  score: number;
}

export interface WebEntity {
  entityId: string;
  description: string;
  score: number;
}

export interface ObjectInfo {
  name: string;
  score: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  vertices: Vertex[];
}

export interface Vertex {
  x: number;
  y: number;
}

// Service Info Response
export interface ServiceInfoResponse {
  supportedFormats: string[];
  maxFiles: number;
  maxFileSizeBytes: number;
  maxTotalSizeBytes: number;
  features: string[];
}

// Health Check Response
export interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
  version: string;
}

class PhotoAnalysisAPI {
  private baseUrl = `${API_BASE_URL}/api/photoanalysis`;


  /**
   * Gelişmiş analiz yapar (Google Vertex AI + Vision + Web Search)
   * @param photos Analiz edilecek fotoğraf dosyaları (1-10 arası)
   * @param language AI analiz dili (tr, en, vb.)
   * @returns Gelişmiş analiz sonucu
   */
  async analyzePhotosEnhanced(photos: File[], language: string = 'en'): Promise<EnhancedAnalysisResponse> {
    try {
      console.log('=== AI ANALİZ BAŞLATILIYOR ===');
      console.log('API Base URL:', API_BASE_URL);
      console.log('Full URL:', `${this.baseUrl}/enhanced`);
      console.log('Platform:', Platform.OS);
      console.log('Is Development:', __DEV__);
      console.log('Photo Count:', photos.length);
      console.log('Language:', language);

      if (!photos || photos.length === 0) {
        throw new Error('En az bir fotoğraf seçilmelidir');
      }

      if (photos.length > 10) {
        throw new Error('En fazla 10 fotoğraf seçilebilir');
      }

      // FormData oluştur (React Native uyumlu)
      const formData = new FormData();

      // Language parametresini ekle
      formData.append('language', language);

      photos.forEach((photo, index) => {
        // React Native için özel format + MIME düzeltmesi
        const normalizedType =
          photo.type && photo.type.includes('/') ? photo.type : 'image/jpeg';
        const photoData = {
          uri: photo.uri || (photo as any).uri,
          type: normalizedType,
          name: photo.name || `photo_${index}.jpg`,
        } as any;

        console.log(`Fotoğraf ${index + 1} ekleniyor:`, {
          uri: photoData.uri?.substring(0, 50) + '...',
          type: photoData.type,
          name: photoData.name
        });

        formData.append('photos', photoData);
      });

      console.log('Gelişmiş API isteği gönderiliyor:', `${this.baseUrl}/enhanced`, { language });

      // Authorization token'ı al
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        console.log('Token bulunamadı!');
        throw new Error('Authentication required');
      }
      
      console.log('Token mevcut:', `(ilk 20 karakter: ${token?.substring(0, 20)}...)`);

      // Axios ile multipart/form-data gönderimi (Android'de fetch yerine)
      console.log('=== AXIOS İLE İSTEK GÖNDERİLİYOR ===');
      console.log('URL:', `${this.baseUrl}/enhanced`);
      console.log('Method: POST');
      console.log('FormData içeriği hazırlanıyor...');
      
      const startTime = Date.now();
      
      try {
        const response = await axios.post(`${this.baseUrl}/enhanced`, formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 120000, // 120 saniye
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            console.log(`Upload progress: ${percentCompleted}%`);
          },
        });
        
        const elapsed = Date.now() - startTime;
        console.log('=== AXIOS BAŞARILI ===');
        console.log('Elapsed time:', elapsed, 'ms');
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        
        const result: EnhancedAnalysisResponse = response.data;
        return result;
      } catch (axiosError: any) {
        const elapsed = Date.now() - startTime;
        console.error('=== AXIOS HATASI ===');
        console.error('Elapsed time:', elapsed, 'ms');
        console.error('Error Type:', axiosError?.constructor?.name);
        console.error('Error Message:', axiosError?.message);
        console.error('Error Code:', axiosError?.code);
        console.error('Response Status:', axiosError?.response?.status);
        console.error('Response Data:', axiosError?.response?.data);
        throw axiosError;
      }
    } catch (error: any) {
      console.error('=== AI ANALİZ HATASI ===');
      console.error('Error Type:', error?.constructor?.name);
      console.error('Error Message:', error?.message);
      console.error('Error Response:', error?.response?.data);
      console.error('Error Code:', error?.code);
      console.error('API Base URL:', API_BASE_URL);
      console.error('Full URL:', `${this.baseUrl}/enhanced`);
      console.error('Platform:', Platform.OS);
      
      // Axios error handling
      if (error?.response) {
        // Backend'den response geldi ama hata var
        const status = error.response.status;
        const message = error.response.data?.message || error.response.data || 'Bilinmeyen hata';
        // Hata mesajını daha kullanıcı dostu hale getir (API hatası prefix'ini kaldır)
        const cleanMessage = typeof message === 'string' && message.startsWith('API hatası') 
          ? message.replace(/^API hatası \(\d+\): /, '') 
          : message;
        throw new Error(cleanMessage);
      } else if (error?.request) {
        // İstek gönderildi ama response alınamadı
        console.error('Network Error - No response received');
        throw new Error('Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.');
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        // Timeout hatası
        throw new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else {
        // Diğer hatalar
        throw error;
      }
    }
  }

  /**
   * Fotoğrafları analiz eder (eski sistem)
   * @param photos Analiz edilecek fotoğraf dosyaları (1-10 arası)
   * @returns Analiz sonucu
   */
  async analyzePhotos(photos: File[]): Promise<PhotoAnalysisResponse> {
    try {
      console.log('PhotoAnalysis API çağrısı başlatılıyor...', { 
        baseUrl: this.baseUrl,
        photoCount: photos.length 
      });

      if (!photos || photos.length === 0) {
        throw new Error('En az bir fotoğraf seçilmelidir');
      }

      if (photos.length > 10) {
        throw new Error('En fazla 10 fotoğraf seçilebilir');
      }

      // FormData oluştur (React Native uyumlu)
      const formData = new FormData();
      
      photos.forEach((photo, index) => {
        // React Native için özel format + MIME düzeltmesi
        const normalizedType =
          photo.type && photo.type.includes('/') ? photo.type : 'image/jpeg';
        const photoData = {
          uri: photo.uri || (photo as any).uri,
          type: normalizedType,
          name: photo.name || `photo_${index}.jpg`,
        } as any;
        
        console.log(`Fotoğraf ${index + 1} ekleniyor:`, { 
          uri: photoData.uri?.substring(0, 50) + '...', 
          type: photoData.type, 
          name: photoData.name 
        });
        
        formData.append('photos', photoData);
      });

      console.log('API isteği gönderiliyor:', `${this.baseUrl}/analyze`);

      // Authorization token'ı al
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      // Axios ile multipart/form-data gönderimi
      const response = await axios.post(`${this.baseUrl}/analyze`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 120 saniye
      });

      console.log('API yanıtı alındı:', { 
        status: response.status, 
        statusText: response.statusText,
      });

      const result: PhotoAnalysisResponse = response.data;
      return result;
    } catch (error: any) {
      console.error('Fotoğraf analizi hatası:', error);
      
      // Axios error handling
      if (error?.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.response.data;
        throw new Error(`API hatası (${status}): ${message}`);
      } else if (error?.request) {
        console.error('Network Error - No response received');
        throw new Error('Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.');
      } else if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        throw new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else {
        throw error;
      }
    }
  }

  /**
   * Servis bilgilerini getirir
   */
  async getServiceInfo(): Promise<ServiceInfoResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/info`);
      
      if (!response.ok) {
        throw new Error(`Servis bilgileri alınamadı: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Servis bilgileri hatası:', error);
      throw error;
    }
  }

  /**
   * Servisin sağlık durumunu kontrol eder
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`Sağlık kontrolü başarısız: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Sağlık kontrolü hatası:', error);
      throw error;
    }
  }

  /**
   * Dosya boyutunu MB cinsinden döndürür
   */
  getFileSizeMB(file: File): number {
    return file.size / (1024 * 1024);
  }

  /**
   * Dosya türünün desteklenip desteklenmediğini kontrol eder
   */
  isSupportedFileType(file: File): boolean {
    const supportedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    // MIME type kontrolü (esnek)
    const mimeTypeValid = supportedMimeTypes.includes(file.type?.toLowerCase()) ||
                         file.type?.toLowerCase().startsWith('image/');
    
    // Dosya uzantısı kontrolü
    const fileName = file.name?.toLowerCase() || '';
    const extensionValid = supportedExtensions.some(ext => fileName.endsWith(ext));
    
    return mimeTypeValid || extensionValid;
  }

  /**
   * Fotoğrafları analiz etmeden önce validasyon yapar
   */
  validatePhotos(photos: File[]): { isValid: boolean; error?: string } {
    if (!photos || photos.length === 0) {
      return { isValid: false, error: 'En az bir fotoğraf seçilmelidir' };
    }

    if (photos.length > 10) {
      return { isValid: false, error: 'En fazla 10 fotoğraf seçilebilir' };
    }

    const maxFileSizeMB = 10;
    const maxTotalSizeMB = 50;
    let totalSize = 0;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      
      // Dosya türü kontrolü
      if (!this.isSupportedFileType(photo)) {
        return { 
          isValid: false, 
          error: `Desteklenmeyen dosya türü: ${photo.type}. Sadece JPEG, PNG ve WebP desteklenir.`
        };
      }

      // Dosya boyutu kontrolü
      const fileSizeMB = this.getFileSizeMB(photo);
      if (fileSizeMB > maxFileSizeMB) {
        return { 
          isValid: false, 
          error: `Dosya çok büyük: ${photo.name} (${fileSizeMB.toFixed(2)}MB). Maksimum ${maxFileSizeMB}MB olmalıdır.`
        };
      }

      totalSize += fileSizeMB;
    }

    // Toplam boyut kontrolü
    if (totalSize > maxTotalSizeMB) {
      return { 
        isValid: false, 
        error: `Toplam dosya boyutu çok büyük (${totalSize.toFixed(2)}MB). Maksimum ${maxTotalSizeMB}MB olmalıdır.`
      };
    }

    return { isValid: true };
  }

  /**
   * Analiz sonucunu kullanıcı dostu formatta döndürür
   */
  formatAnalysisResult(result: PhotoAnalysisResult): {
    summary: string;
    details: string[];
    confidence: string;
  } {
    const confidencePercent = Math.round(result.confidence_overall * 100);
    const confidenceText = confidencePercent >= 80 ? 'Yüksek' : 
                          confidencePercent >= 60 ? 'Orta' : 'Düşük';

    const details: string[] = [];
    
    if (result.period && result.period !== 'bilinmiyor') {
      details.push(`Dönem: ${result.period}`);
    }
    
    if (result.materials.length > 0 && result.materials[0] !== 'bilinmiyor') {
      details.push(`Malzeme: ${result.materials.join(', ')}`);
    }
    
    if (result.entities.length > 0) {
      const brands = result.entities.filter(e => e.type === 'brand_or_model');
      if (brands.length > 0) {
        details.push(`Marka/Model: ${brands.map(b => b.name).join(', ')}`);
      }
    }
    
    if (result.hashtags.length > 0) {
      details.push(`Hashtag'ler: ${result.hashtags.slice(0, 5).join(' ')}`);
    }

    return {
      summary: result.title,
      details,
      confidence: `${confidenceText} (%${confidencePercent})`
    };
  }
}

// Singleton instance
export const photoAnalysisAPI = new PhotoAnalysisAPI();
