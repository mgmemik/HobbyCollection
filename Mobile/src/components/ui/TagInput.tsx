import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  style?: any;
};

interface ParsedContent {
  title: string;
  description: string;
  hashtags: string[];
}

export const TagInput: React.FC<Props> = ({ 
  value, 
  onChangeText, 
  placeholder, 
  multiline, 
  numberOfLines, 
  style 
}) => {
  const { colors } = useTheme();
  const [parsedContent, setParsedContent] = useState<ParsedContent>({
    title: '',
    description: '',
    hashtags: []
  });
  const [inputText, setInputText] = useState('');
  const isUserTypingRef = useRef(false); // Kullanıcının yazdığını izlemek için

  // Metin satır sayısına göre dinamik yükseklik hesapla
  const calculateInputHeight = () => {
    const lines = inputText.split('\n');
    const lineCount = lines.length;
    // Her satır yaklaşık 22px (fontSize 15 + line height)
    // Minimum 2 satır (80px), maksimum 4 satır (140px)
    const baseHeight = 80;
    const lineHeight = 22;
    const maxLines = 4;
    const calculatedLines = Math.min(Math.max(2, lineCount), maxLines);
    return baseHeight + (calculatedLines - 2) * lineHeight;
  };

  // Value değiştiğinde içeriği parse et
  useEffect(() => {
    const lines = value.split('\n');
    const title = lines[0] || '';
    
    // Description: 2. satırdan hashtag'lerin başladığı yere kadar TÜM SATIRLAR
    // Hashtag'ler genellikle # ile başlar, ama açıklama içinde de # olabilir
    // Hashtag alanı: Sadece # ile başlayan ve sadece hashtag formatında olan satırlar
    let descriptionEndIndex = lines.length;
    for (let i = 1; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      // Eğer satır sadece hashtag içeriyorsa (başında # var ve sadece hashtag formatında), hashtag alanı başlamış demektir
      if (trimmedLine && trimmedLine.startsWith('#')) {
        // Sadece hashtag'lerden oluşuyorsa (boşluk, #, harf/rakam karakterleri)
        const isOnlyHashtags = /^[\s#\w]+$/.test(trimmedLine) && trimmedLine.split(/\s+/).every(word => word.startsWith('#'));
        if (isOnlyHashtags) {
          descriptionEndIndex = i;
          break;
        }
      }
    }
    // Description'ı birleştir (yeni satırları koru) - 1. satırdan (index 1) hashtag'lerin başladığı yere kadar
    const description = lines.slice(1, descriptionEndIndex).join('\n');
    
    // Hashtag'leri SADECE hashtag alanından topla (başlık/açıklamadaki # işaretlerini dahil etme)
    // Özel karakterleri de yakala (®, &, -, : vb)
    const hashtagsArea = lines.slice(descriptionEndIndex).join('\n');
    const hashtagMatches = hashtagsArea.match(/#[^\s#]+/g) || [];
    const hashtags = hashtagMatches.map(tag => tag.substring(1)); // # işaretini kaldır
    
    setParsedContent({ title, description, hashtags });
    
    // Input text'i hashtag'ler olmadan göster (title + description)
    const textWithoutHashtags = lines.slice(0, descriptionEndIndex).join('\n');
    
    // Kullanıcı yazıyorsa inputText'i güncelleme (cursor pozisyonu korunur)
    if (!isUserTypingRef.current) {
      setInputText(textWithoutHashtags);
    }
  }, [value]);

  // Input değiştiğinde
  const handleInputChange = (text: string) => {
    // Kullanıcının yazdığını işaretle
    isUserTypingRef.current = true;
    
    // Boşluk veya yeni satırla biten hashtag'leri kontrol et (#kelime + boşluk/enter)
    const hashtagPattern = /#[^\s#]+[\s\n]/g;
    const hashtagMatches = text.match(hashtagPattern);
    
    if (hashtagMatches && hashtagMatches.length > 0) {
      // Hashtag(ler) tamamlandı, chip'e dönüştür
      let cleanedText = text;
      const newHashtags: string[] = [];
      
      hashtagMatches.forEach(match => {
        const tag = match.trim().substring(1); // # ve boşluk/newline'ı kaldır
        if (tag.length > 0) {
          newHashtags.push(tag);
          cleanedText = cleanedText.replace(match, ' ');
        }
      });
      
      // Metni temizle - SADECE satır içi fazla boşlukları kaldır, newline'ları koru
      cleanedText = cleanedText.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n');
      
      const updatedHashtags = [...parsedContent.hashtags, ...newHashtags];
      setInputText(cleanedText);
      
      // Ana değeri güncelle - TÜM SATIRLARI KORU
      const lines = cleanedText.split('\n');
      const updatedValue = [
        ...lines, // Tüm satırları koru (title + description satırları)
        ...updatedHashtags.map(tag => `#${tag}`)
      ].join('\n');
      
      onChangeText(updatedValue);
    } else {
      // Normal metin değişikliği
      setInputText(text);
      
      // TÜM SATIRLARI KORU - birden fazla description satırı olabilir
      const lines = text.split('\n');
      const updatedValue = [
        ...lines, // Tüm satırları koru (title + description satırları)
        ...parsedContent.hashtags.map(tag => `#${tag}`)
      ].join('\n');
      
      onChangeText(updatedValue);
    }
    
    // Kısa bir süre sonra kullanıcının yazmayı bıraktığını varsay
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 100);
  };

  // Hashtag silme
  const removeHashtag = (indexToRemove: number) => {
    isUserTypingRef.current = true; // Değişiklik yapıldığını işaretle
    
    const updatedHashtags = parsedContent.hashtags.filter((_, index) => index !== indexToRemove);
    const lines = inputText.split('\n');
    const updatedValue = [
      ...lines, // Tüm satırları koru (title + description satırları)
      ...updatedHashtags.map(tag => `#${tag}`)
    ].join('\n');
    
    onChangeText(updatedValue);
    
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 100);
  };

  // Temizle
  const clearAll = () => {
    isUserTypingRef.current = true; // Değişiklik yapıldığını işaretle
    
    setInputText('');
    onChangeText('');
    
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 100);
  };

  return (
    <View style={[{
      backgroundColor: colors.inputBg,
      borderColor: colors.inputBorder,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 120,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      width: '100%',
    }, style]}>
      
      {/* Ana Input Alanı */}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholder}
        value={inputText}
        onChangeText={handleInputChange}
        multiline={true}
        scrollEnabled={true}
        style={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: parsedContent.hashtags.length > 0 ? 8 : 14,
          color: colors.text,
          fontSize: 15,
          textAlignVertical: 'top',
          minHeight: Math.max(
            parsedContent.hashtags.length > 0 ? 60 : 80,
            calculateInputHeight()
          ),
        }}
      />

      {/* Hashtag Etiketleri */}
      {parsedContent.hashtags.length > 0 && (
        <View style={{
          paddingHorizontal: 16,
          paddingBottom: 14,
        }}>
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {parsedContent.hashtags.map((tag, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: colors.primary + '20',
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  marginRight: 8,
                  marginBottom: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: '500',
                  marginRight: 4,
                }}>
                  #{tag}
                </Text>
                <TouchableOpacity
                  onPress={() => removeHashtag(index)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: colors.primary + '40',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={10} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Temizle Butonu */}
      {(inputText.length > 0 || parsedContent.hashtags.length > 0) && (
        <TouchableOpacity
          onPress={clearAll}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.textMuted + '20',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
};
