import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export const AICreditsPolicyScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
        {title}
      </Text>
      {children}
    </View>
  );

  const BulletItem: React.FC<{ text: string }> = ({ text }) => (
    <View style={{ flexDirection: 'row', marginBottom: 6, paddingLeft: 4 }}>
      <Text style={{ color: colors.primary, marginRight: 8 }}>•</Text>
      <Text style={{ flex: 1, fontSize: 14, color: colors.textMuted, lineHeight: 20 }}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={colors.text === '#e8e9eb' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 }}>
          {t('aiCreditsPolicy.pageTitle')}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 24 }}>
          {t('aiCreditsPolicy.intro')}
        </Text>

        <Section title={t('aiCreditsPolicy.whatAreTitle')}>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22 }}>
            {t('aiCreditsPolicy.whatAreBody')}
          </Text>
        </Section>

        <Section title={t('aiCreditsPolicy.howToGetTitle')}>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 8 }}>
            {t('aiCreditsPolicy.howToGetBody')}
          </Text>
          <BulletItem text={t('aiCreditsPolicy.howToGetAccount')} />
          <BulletItem text={t('aiCreditsPolicy.howToGetMonthly')} />
          <BulletItem text={t('aiCreditsPolicy.howToGetPurchase')} />
        </Section>

        <Section title={t('aiCreditsPolicy.howUsedTitle')}>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 8 }}>
            {t('aiCreditsPolicy.howUsedBody')}
          </Text>
          <BulletItem text={t('aiCreditsPolicy.howUsedRecognition')} />
          <BulletItem text={t('aiCreditsPolicy.howUsedPrice')} />
          <BulletItem text={t('aiCreditsPolicy.howUsedRefund')} />
        </Section>

        <Section title={t('aiCreditsPolicy.monthlyRechargeTitle')}>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22 }}>
            {t('aiCreditsPolicy.monthlyRechargeBody')}
          </Text>
        </Section>

        <Section title={t('aiCreditsPolicy.purchasingCreditsTitle')}>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22 }}>
            {t('aiCreditsPolicy.purchasingCreditsBody')}
          </Text>
        </Section>

        <Section title={t('aiCreditsPolicy.midMonthTitle')}>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 8 }}>
            {t('aiCreditsPolicy.midMonthBody')}
          </Text>
          <BulletItem text={t('aiCreditsPolicy.midMonthUpgrade')} />
          <BulletItem text={t('aiCreditsPolicy.midMonthPurchase')} />
          <BulletItem text={t('aiCreditsPolicy.midMonthDowngrade')} />
        </Section>

        <Section title={t('aiCreditsPolicy.premiumEndsTitle')}>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22, marginBottom: 8 }}>
            {t('aiCreditsPolicy.premiumEndsBody')}
          </Text>
          <BulletItem text={t('aiCreditsPolicy.premiumEndsBalance')} />
          <BulletItem text={t('aiCreditsPolicy.premiumEndsRecharge')} />
          <BulletItem text={t('aiCreditsPolicy.premiumEndsNoRefund')} />
          <BulletItem text={t('aiCreditsPolicy.premiumEndsFeatures')} />
        </Section>

        <Section title={t('aiCreditsPolicy.unusedCreditsTitle')}>
          <Text style={{ fontSize: 14, color: colors.textMuted, lineHeight: 22 }}>
            {t('aiCreditsPolicy.unusedCreditsBody')}
          </Text>
        </Section>

        <Section title={t('aiCreditsPolicy.otherRulesTitle')}>
          <BulletItem text={t('aiCreditsPolicy.otherRulesNoRefund')} />
          <BulletItem text={t('aiCreditsPolicy.otherRulesSupport')} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};
