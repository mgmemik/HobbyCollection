import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { getMyPlan, type PlanDetails } from '../api/plan';
import i18n from '../i18n';

export type PremiumFeature = 
  | 'CsvExport' 
  | 'ProductBadges' 
  | 'PrivateProducts' 
  | 'Showcase' 
  | 'CollectionReport' 
  | 'PremiumAICredits';

const featureLabels: Record<PremiumFeature, { tr: string; en: string }> = {
  CsvExport: { tr: 'CSV Export', en: 'CSV Export' },
  ProductBadges: { tr: 'Ürün Badge\'leri', en: 'Product Badges' },
  PrivateProducts: { tr: 'Özel Ürünler', en: 'Private Products' },
  Showcase: { tr: 'Vitrin', en: 'Showcase' },
  CollectionReport: { tr: 'Koleksiyon Raporu', en: 'Collection Report' },
  PremiumAICredits: { tr: 'Premium AI Kredisi', en: 'Premium AI Credits' },
};

export interface UsePremiumResult {
  isPremium: boolean;
  planDetails: PlanDetails | null;
  loading: boolean;
  error: string | null;
  
  /** Özelliğe erişim var mı kontrol et */
  hasFeature: (feature: PremiumFeature) => boolean;
  
  /** Premium gerektiren özellik için uyarı göster, true dönerse işleme devam edebilir */
  checkFeatureAccess: (feature: PremiumFeature, onUpgrade?: () => void) => boolean;
  
  /** Premium uyarı alert'i göster */
  showPremiumAlert: (feature: PremiumFeature, onUpgrade?: () => void) => void;
  
  /** Plan bilgisini yenile */
  refresh: () => Promise<void>;
}

export function usePremium(): UsePremiumResult {
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const details = await getMyPlan();
      setPlanDetails(details);
    } catch (err: any) {
      console.error('Failed to load plan:', err);
      setError(err.message || 'Plan yüklenemedi');
      // Default to standard on error
      setPlanDetails({
        plan: 'standard',
        isPremium: false,
        autoRenews: false,
        cancelAtPeriodEnd: false,
        monthlyAICredits: 50,
        features: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const isPremium = planDetails?.isPremium ?? false;

  const hasFeature = useCallback((feature: PremiumFeature): boolean => {
    return isPremium;
  }, [isPremium]);

  const getFeatureLabel = (feature: PremiumFeature): string => {
    const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en';
    return featureLabels[feature]?.[lang] || feature;
  };

  const showPremiumAlert = useCallback((feature: PremiumFeature, onUpgrade?: () => void) => {
    const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en';
    const featureLabel = getFeatureLabel(feature);
    
    const title = lang === 'tr' ? 'Premium Özellik' : 'Premium Feature';
    const message = lang === 'tr' 
      ? `"${featureLabel}" özelliği Premium abonelik gerektirir. Premium'a yükselterek tüm özelliklere erişebilirsiniz.`
      : `"${featureLabel}" feature requires Premium subscription. Upgrade to Premium to access all features.`;
    const upgradeButton = lang === 'tr' ? 'Premium\'a Yükselt' : 'Upgrade to Premium';
    const cancelButton = lang === 'tr' ? 'Tamam' : 'OK';

    Alert.alert(
      title,
      message,
      [
        { text: cancelButton, style: 'cancel' },
        ...(onUpgrade ? [{ text: upgradeButton, onPress: onUpgrade }] : []),
      ]
    );
  }, []);

  const checkFeatureAccess = useCallback((feature: PremiumFeature, onUpgrade?: () => void): boolean => {
    if (isPremium) {
      return true;
    }
    showPremiumAlert(feature, onUpgrade);
    return false;
  }, [isPremium, showPremiumAlert]);

  return {
    isPremium,
    planDetails,
    loading,
    error,
    hasFeature,
    checkFeatureAccess,
    showPremiumAlert,
    refresh: loadPlan,
  };
}
