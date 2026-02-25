import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getReportReasons, createReport, ReportReason } from '../api/reports';
import { useToast } from './ui/Toast';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'product' | 'user' | 'comment';
  contentId: string;
  contentTitle?: string; // Ürün başlığı veya kullanıcı adı (gösterim için)
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  contentType,
  contentId,
  contentTitle,
}) => {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [reasons, setReasons] = useState<ReportReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingReasons, setLoadingReasons] = useState(false);

  useEffect(() => {
    if (visible) {
      loadReasons();
    } else {
      // Modal kapandığında state'i sıfırla
      setSelectedReason('');
      setDescription('');
    }
  }, [visible]);

  const loadReasons = async () => {
    setLoadingReasons(true);
    try {
      const data = await getReportReasons();
      console.log('Loaded report reasons:', data);
      setReasons(data || []);
    } catch (error: any) {
      console.error('Error loading report reasons:', error);
      toast.show({ 
        type: 'error', 
        message: t('report.loadError') || 'Şikayet sebepleri yüklenemedi' 
      });
      setReasons([]);
    } finally {
      setLoadingReasons(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.show({ 
        type: 'error', 
        message: t('report.selectReason') || 'Lütfen bir sebep seçin' 
      });
      return;
    }

    setSubmitting(true);
    try {
      await createReport({
        contentType,
        contentId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      toast.show({ 
        type: 'success', 
        message: t('report.submitted') || 'Şikayetiniz alındı. İnceleme sürecine alınacaktır.' 
      });
      onClose();
    } catch (error: any) {
      const errorMessage = error?.message || t('report.submitError') || 'Şikayet gönderilirken bir hata oluştu';
      toast.show({ type: 'error', message: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const getContentTypeLabel = () => {
    switch (contentType) {
      case 'product':
        return t('report.contentType.product') || 'Ürün';
      case 'user':
        return t('report.contentType.user') || 'Kullanıcı';
      case 'comment':
        return t('report.contentType.comment') || 'Yorum';
      default:
        return '';
    }
  };

  const getReasonLabel = (reason: ReportReason) => {
    const lang = i18n.language || 'en';
    return lang === 'tr' ? reason.label.tr : reason.label.en;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          width: '100%',
          maxWidth: 500,
          height: SCREEN_HEIGHT * 0.75,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'column',
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: colors.text,
                marginBottom: 4,
              }}>
                {t('report.title') || 'İçeriği Şikayet Et'}
              </Text>
              <Text style={{
                fontSize: 14,
                color: colors.textMuted,
              }}>
                {getContentTypeLabel()}: {contentTitle || contentId}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView 
            style={{ flex: 1, minHeight: 200 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {/* Sebep Seçimi */}
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.text,
              marginBottom: 12,
            }}>
              {t('report.selectReason') || 'Şikayet Sebebi'}
            </Text>

            {loadingReasons ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : reasons.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted }}>
                  {t('report.loadError') || 'Şikayet sebepleri yüklenemedi'}
                </Text>
              </View>
            ) : (
              <View style={{ marginBottom: 20 }}>
                {reasons.map((reason) => (
                    <Pressable
                      key={reason.value}
                      onPress={() => setSelectedReason(reason.value)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        marginBottom: 8,
                        borderRadius: 12,
                        backgroundColor: selectedReason === reason.value 
                          ? colors.primary + '20' 
                          : colors.background,
                        borderWidth: 1,
                        borderColor: selectedReason === reason.value 
                          ? colors.primary 
                          : colors.border,
                      }}
                    >
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: selectedReason === reason.value 
                          ? colors.primary 
                          : colors.border,
                        backgroundColor: selectedReason === reason.value 
                          ? colors.primary 
                          : 'transparent',
                        marginRight: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {selectedReason === reason.value && (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                      </View>
                      <Text style={{
                        fontSize: 15,
                        color: colors.text,
                        flex: 1,
                      }}>
                        {getReasonLabel(reason)}
                      </Text>
                    </Pressable>
                ))}
              </View>
            )}

            {/* Açıklama (Opsiyonel) */}
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: colors.text,
              marginBottom: 12,
              marginTop: 8,
            }}>
              {t('report.description') || 'Açıklama (Opsiyonel)'}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('report.descriptionPlaceholder') || 'Ek bilgi ekleyebilirsiniz...'}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              maxLength={500}
              style={{
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 16,
                color: colors.text,
                fontSize: 15,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
            <Text style={{
              fontSize: 12,
              color: colors.textMuted,
              marginTop: 4,
              textAlign: 'right',
            }}>
              {description.length}/500
            </Text>
          </ScrollView>

          {/* Footer */}
          <View style={{
            flexDirection: 'row',
            padding: 20,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 12,
          }}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.text,
              }}>
                {t('common.cancel') || 'İptal'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!selectedReason || submitting}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: selectedReason && !submitting 
                  ? colors.primary 
                  : colors.primary + '40', // Disabled durumda bile primary rengi kullan ama şeffaf
                alignItems: 'center',
                opacity: (!selectedReason || submitting) ? 0.7 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: selectedReason ? '#fff' : '#fff', // Her durumda beyaz text
                }}>
                  {t('report.submit') || 'Şikayet Et'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
