/**
 * Subscription Product ID'leri
 * Apple App Store ve Google Play Store için product ID'ler
 */
export const SUBSCRIPTION_PRODUCTS = {
  APPLE: {
    PREMIUM_MONTHLY: 'com.gmemik.saveall.premium.monthly',
  },
  GOOGLE: {
    PREMIUM_MONTHLY: 'com.gmemik.saveall.premium.monthly', // Google için ayrı ID (henüz oluşturulmadı)
  },
} as const;

/**
 * Fallback fiyat (product bilgisi alınamazsa kullanılır)
 */
export const FALLBACK_PRICE = {
  amount: 4.99,
  currency: 'USD',
  formatted: '$4.99',
};
