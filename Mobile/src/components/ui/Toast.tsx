import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

type ToastType = 'success' | 'error' | 'info';

type ToastOptions = {
  type?: ToastType;
  message: string;
  subMessage?: string;
  durationMs?: number; // default 2500
};

type ToastContextType = {
  show: (opts: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType>({ show: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<ToastOptions>({ message: '', type: 'info' });
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const palette = useMemo(() => {
    switch (opts.type) {
      case 'success':
        return { bg: colors.primary, fg: colors.primaryTextOnPrimary, icon: 'checkmark-circle' as const };
      case 'error':
        return { bg: '#FF3B30', fg: 'white', icon: 'alert-circle' as const };
      default:
        return { bg: colors.accent, fg: colors.primaryTextOnPrimary, icon: 'information-circle' as const };
    }
  }, [opts.type, colors]);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 60, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [opacity, translateY]);

  const show = useCallback((options: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpts({ type: 'info', durationMs: 2500, ...options });
    setVisible(true);
    translateY.setValue(60);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(hide, (options.durationMs ?? 2500));
  }, [hide, opacity, translateY]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {visible && (
        <Animated.View style={{ position: 'absolute', left: 12, right: 12, bottom: 24, transform: [{ translateY }], opacity }}>
          <View style={{ backgroundColor: palette.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 }}>
            <Ionicons name={palette.icon} size={20} color={palette.fg} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.fg, fontSize: 14, fontWeight: '700' }}>{opts.message}</Text>
              {!!opts.subMessage && (
                <Text style={{ color: palette.fg + 'CC', fontSize: 12, marginTop: 2 }}>{opts.subMessage}</Text>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};









