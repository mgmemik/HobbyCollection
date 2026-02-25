import React from 'react';
import { Modal, View, Pressable, Dimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { PinchZoomImage } from './PinchZoomImage';

type AvatarViewerModalProps = {
  visible: boolean;
  uri: string | null | undefined;
  onClose: () => void;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const AvatarViewerModal: React.FC<AvatarViewerModalProps> = ({ visible, uri, onClose }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        {/* Backdrop */}
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Image */}
        {uri ? (
          <View style={{ flex: 1 }}>
            <PinchZoomImage
              uri={uri}
              contentFit="contain"
              containerWidth={screenWidth}
              containerHeight={screenHeight}
              style={{ width: screenWidth, height: screenHeight }}
            />
          </View>
        ) : null}

        {/* Close button (bottom; safe-area aware) */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: insets.bottom + 16,
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={onClose}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: colors.surface + 'CC',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="close" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>Kapat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

