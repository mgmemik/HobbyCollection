import React, { useState } from 'react';
import { Image, View, StyleSheet, Text } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

export const Logo: React.FC<{ size?: number }> = ({ size = 64 }) => {
	const { colors } = useTheme();
	const [imageError, setImageError] = useState(false);

	// Fallback SVG logo
	const FallbackLogo = () => (
		<View style={[styles.fallbackContainer, { width: size, height: size, backgroundColor: '#FF7A59', borderRadius: size * 0.2 }]}>
			<Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 64 64">
				<Path
					d="M8 12 L8 52 L48 52 L48 20 L40 12 Z M40 12 L40 20 L48 20"
					stroke="white"
					strokeWidth="4"
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<Path
					d="M 20 28 Q 20 24 24 24 Q 28 24 28 28 Q 28 30 26 31 L 26 34 M 26 38 L 26 38.5"
					stroke="white"
					strokeWidth="3"
					fill="none"
					strokeLinecap="round"
				/>
				<Path
					d="M 32 28 Q 32 24 36 24 Q 40 24 40 28 Q 40 30 38 31 L 38 34 M 38 38 L 38 38.5"
					stroke="white"
					strokeWidth="3"
					fill="none"
					strokeLinecap="round"
				/>
			</Svg>
		</View>
	);

	if (imageError) {
		return <FallbackLogo />;
	}

	return (
		<View style={[styles.container, { width: size, height: size }]}>
			<Image 
				source={require('../../assets/icon.png')} 
				style={{ width: size, height: size, borderRadius: size * 0.2 }}
				resizeMode="contain"
				onError={() => setImageError(true)}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	fallbackContainer: {
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
	},
});
