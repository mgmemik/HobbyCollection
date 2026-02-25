import React, { useRef, useState } from 'react';
import { Animated } from 'react-native';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';

type PinchZoomImageProps = {
  uri: string;
  style: any;
  contentFit?: 'cover' | 'contain';
  onPinchActiveChange?: (active: boolean) => void;
  containerWidth: number;
  containerHeight: number;
};

/**
 * Inline pinch-to-zoom ve pan destekli resim komponenti.
 * Instagram, Google Photos gibi uygulamalardaki zoom davranışını taklit eder.
 */
export const PinchZoomImage: React.FC<PinchZoomImageProps> = ({ 
  uri, 
  style, 
  contentFit = 'contain', 
  onPinchActiveChange, 
  containerWidth, 
  containerHeight 
}) => {
  // Scale state
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(baseScale, pinchScale);
  const lastScale = useRef(1);
  const [isPanEnabled, setIsPanEnabled] = useState(false); // Pan sadece zoom > 1 olduğunda

  // Translation state (pan için)
  const baseTranslateX = useRef(new Animated.Value(0)).current;
  const baseTranslateY = useRef(new Animated.Value(0)).current;
  const panTranslateX = useRef(new Animated.Value(0)).current;
  const panTranslateY = useRef(new Animated.Value(0)).current;

  const translateX = Animated.add(baseTranslateX, panTranslateX);
  const translateY = Animated.add(baseTranslateY, panTranslateY);

  // Last values (gesture bitiminde kaydetmek için)
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  // Pinch focal point (zoom merkezi)
  const pinchCenterX = useRef(0);
  const pinchCenterY = useRef(0);
  const scaleAtPinchStart = useRef(1);

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: any) => {
    const state = event?.nativeEvent?.state;
    const oldState = event?.nativeEvent?.oldState;

    if (state === State.BEGAN) {
      // Pinch başladığında dışarıya bildir (carousel scroll'u kilitlemek için)
      onPinchActiveChange?.(true);
      
      // Focal point'i kaydet
      pinchCenterX.current = event.nativeEvent.focalX - containerWidth / 2;
      pinchCenterY.current = event.nativeEvent.focalY - containerHeight / 2;
      scaleAtPinchStart.current = lastScale.current;
    }

    if (state === State.ACTIVE) {
      // Pinch aktifken dışarıya bildir
      onPinchActiveChange?.(true);
    }

    if (oldState === State.ACTIVE) {
      // Pinch bitti
      onPinchActiveChange?.(false);

      const nextScale = lastScale.current * (event.nativeEvent.scale || 1);
      const clampedScale = Math.max(1, Math.min(nextScale, 3.5));
      lastScale.current = clampedScale;

      // Focal point'e göre translation'ı ayarla
      const scaleDiff = clampedScale - scaleAtPinchStart.current;
      lastTranslateX.current = lastTranslateX.current - pinchCenterX.current * scaleDiff;
      lastTranslateY.current = lastTranslateY.current - pinchCenterY.current * scaleDiff;

      // Boundary kontrolü (fotoğrafın çok uzağa kaymasını engelle)
      // Scale = 1 olduğunda hiç hareket etmemeli
      if (clampedScale <= 1) {
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
      } else {
        // Cover modunda fotoğraf zaten taşıyor, boundary'leri daha dar tutuyoruz
        const boundaryMultiplier = contentFit === 'cover' ? 0.4 : 0.5;
        const maxTranslate = Math.max(0, ((clampedScale - 1) * containerWidth) * boundaryMultiplier);
        lastTranslateX.current = Math.max(-maxTranslate, Math.min(maxTranslate, lastTranslateX.current));
        lastTranslateY.current = Math.max(-maxTranslate, Math.min(maxTranslate, lastTranslateY.current));
      }

      // Base değerlerini güncelle
      baseScale.setValue(clampedScale);
      pinchScale.setValue(1);
      baseTranslateX.setValue(lastTranslateX.current);
      baseTranslateY.setValue(lastTranslateY.current);

      // 1x'e çok yakınsa sıfırla
      if (clampedScale <= 1.05) {
        lastScale.current = 1;
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        baseScale.setValue(1);
        pinchScale.setValue(1);
        baseTranslateX.setValue(0);
        baseTranslateY.setValue(0);
        setIsPanEnabled(false); // Pan'i devre dışı bırak
      } else {
        setIsPanEnabled(true); // Zoom varsa pan'i aktif et
      }
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      onPinchActiveChange?.(false);
    }
  };

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: panTranslateX, translationY: panTranslateY } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = (event: any) => {
    const state = event?.nativeEvent?.state;
    const oldState = event?.nativeEvent?.oldState;

    if (state === State.BEGAN || state === State.ACTIVE) {
      onPinchActiveChange?.(true); // Carousel scroll'u kilitle
    }

    if (oldState === State.ACTIVE) {
      // Pan bitti, base değerlerini güncelle
      lastTranslateX.current = lastTranslateX.current + (event.nativeEvent.translationX || 0);
      lastTranslateY.current = lastTranslateY.current + (event.nativeEvent.translationY || 0);

      // Boundary kontrolü
      const currentScale = lastScale.current;
      if (currentScale <= 1) {
        // Scale = 1 olduğunda hiç hareket etmemeli
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
      } else {
        const boundaryMultiplier = contentFit === 'cover' ? 0.4 : 0.5;
        const maxTranslate = Math.max(0, ((currentScale - 1) * containerWidth) * boundaryMultiplier);
        lastTranslateX.current = Math.max(-maxTranslate, Math.min(maxTranslate, lastTranslateX.current));
        lastTranslateY.current = Math.max(-maxTranslate, Math.min(maxTranslate, lastTranslateY.current));
      }

      baseTranslateX.setValue(lastTranslateX.current);
      baseTranslateY.setValue(lastTranslateY.current);
      panTranslateX.setValue(0);
      panTranslateY.setValue(0);

      onPinchActiveChange?.(false); // Carousel scroll'u aç
    }

    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      onPinchActiveChange?.(false);
    }
  };

  return (
    <PanGestureHandler
      onGestureEvent={onPanGestureEvent}
      onHandlerStateChange={onPanStateChange}
      minPointers={1}
      maxPointers={1}
      enabled={isPanEnabled}
    >
      <Animated.View style={{ width: '100%', height: '100%' }}>
        <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchStateChange}>
          <Animated.View style={{ width: '100%', height: '100%' }}>
            <Animated.Image
              source={{ uri }}
              resizeMode={contentFit === 'cover' ? 'cover' : 'contain'}
              style={[
                style,
                {
                  transform: [{ translateX }, { translateY }, { scale }],
                },
              ]}
              onError={(error: any) => {
                console.log('PinchZoomImage load error:', error);
                console.log('Failed URL:', uri);
              }}
            />
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>
    </PanGestureHandler>
  );
};

