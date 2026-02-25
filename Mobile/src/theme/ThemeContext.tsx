import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightPalette, darkPalette, BRAND_COLOR, Palette, PALETTES, NamedPalette } from './config';

export type AppTheme = 'light' | 'dark';

type ThemeContextValue = {
	currentTheme: AppTheme;
	colors: Palette;
	brand: string;
	toggleTheme: () => void;
  currentPaletteId: string;
  setPalette: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'app_theme';
const STORAGE_PALETTE_KEY = 'app_palette_id';

export const useTheme = () => {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
	return ctx;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState<AppTheme>('light');
    const [currentPaletteId, setCurrentPaletteId] = useState<string>('white');

	useEffect(() => {
		(async () => {
			const saved = await AsyncStorage.getItem(STORAGE_KEY);
			if (saved === 'light' || saved === 'dark') {
				setCurrentTheme(saved);
				return;
			}
			const system: ColorSchemeName = Appearance.getColorScheme();
			setCurrentTheme(system === 'dark' ? 'dark' : 'light');

        const storedPalette = await AsyncStorage.getItem(STORAGE_PALETTE_KEY);
        if (storedPalette && PALETTES.find(p => p.id === storedPalette)) {
          setCurrentPaletteId(storedPalette);
        } else {
          setCurrentPaletteId('white');
        }
		})();
	}, []);

	const toggleTheme = useCallback(() => {
		setCurrentTheme(prev => {
			const next = prev === 'light' ? 'dark' : 'light';
			AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
			return next;
		});
	}, []);

  const setPalette = useCallback((id: string) => {
    const exists = PALETTES.find(p => p.id === id);
    if (!exists) return;
    setCurrentPaletteId(id);
    AsyncStorage.setItem(STORAGE_PALETTE_KEY, id).catch(() => {});
  }, []);

  const activePalette = PALETTES.find(p => p.id === currentPaletteId) || { light: lightPalette, dark: darkPalette } as NamedPalette;
	const colors = currentTheme === 'dark' ? activePalette.dark : activePalette.light;
	const value = useMemo(() => ({ currentTheme, colors, brand: BRAND_COLOR, toggleTheme, currentPaletteId, setPalette }), [currentTheme, colors, currentPaletteId, setPalette]);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
