import React from 'react';
import { Pressable, Text, ViewStyle, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
	title: string;
	onPress?: () => void;
	variant?: 'primary' | 'outline';
	loading?: boolean;
	style?: ViewStyle;
	disabled?: boolean;
};

export const Button: React.FC<Props> = ({ title, onPress, variant = 'primary', loading, style, disabled }) => {
	const { colors } = useTheme();
	const base: ViewStyle = {
		paddingVertical: 12,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: variant === 'outline' ? colors.inputBorder : 'transparent',
		backgroundColor: variant === 'primary' ? colors.primary : 'transparent',
	};
	return (
		<Pressable onPress={onPress} disabled={disabled || loading} style={[base, style, disabled ? { opacity: 0.6 } : null]}>
			{loading ? (
				<ActivityIndicator color={variant === 'primary' ? colors.primaryTextOnPrimary : colors.text} />
			) : (
				<Text style={{ color: variant === 'primary' ? colors.primaryTextOnPrimary : colors.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
			)}
		</Pressable>
	);
};
