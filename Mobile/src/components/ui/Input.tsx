import React from 'react';
import { TextInput, View, Text, ViewStyle, TextInputProps } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
	placeholder?: string;
	value: string;
	onChangeText: (t: string) => void;
	secureTextEntry?: boolean;
	style?: ViewStyle;
    multiline?: boolean;
    numberOfLines?: number;
    editable?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'style'>;

export const Input = React.forwardRef<TextInput, Props>(({ placeholder, value, onChangeText, keyboardType, secureTextEntry, style, multiline, numberOfLines, autoCapitalize, editable = true, ...rest }, ref) => {
	const { colors } = useTheme();
	return (
		<View style={{ width: '100%' }}>
			<TextInput
				ref={ref}
				placeholder={placeholder}
				placeholderTextColor={colors.inputPlaceholder}
				value={value}
				onChangeText={onChangeText}
				keyboardType={keyboardType}
				secureTextEntry={secureTextEntry}
				multiline={multiline}
				numberOfLines={numberOfLines}
				autoCapitalize={autoCapitalize}
				editable={editable}
				{...rest}
				style={[{
					backgroundColor: colors.inputBg,
					borderColor: colors.inputBorder,
					borderWidth: 1,
					borderRadius: 12,
					paddingHorizontal: 16,
					paddingVertical: multiline ? 14 : 12,
					color: colors.text,
					fontSize: 15,
					textAlignVertical: multiline ? 'top' : 'center',
					minHeight: multiline ? 60 : 44,
					shadowColor: '#000',
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 0.05,
					shadowRadius: 2,
					elevation: 1,
				}, style]}
			/>
		</View>
	);
});
