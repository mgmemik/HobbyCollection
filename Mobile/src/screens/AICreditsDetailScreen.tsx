import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { 
  getUserCreditSummary, 
  getUserTransactions, 
  getOperationCosts,
  UserCreditSummary,
  AICreditTransaction,
  AIOperationCost 
} from '../api/aiCredits';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { usePremium } from '../hooks/usePremium';

export const AICreditsDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const { isPremium, planDetails } = usePremium();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<UserCreditSummary | null>(null);
  const [transactions, setTransactions] = useState<AICreditTransaction[]>([]);
  const [operationCosts, setOperationCosts] = useState<AIOperationCost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadData = async (isRefresh: boolean = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setPage(1);
      } else {
        setLoading(true);
      }
      
      const [summaryData, transactionsData, costsData] = await Promise.all([
        getUserCreditSummary(),
        getUserTransactions(1, 50),
        getOperationCosts()
      ]);
      
      setSummary(summaryData);
      setTransactions(transactionsData.transactions);
      setOperationCosts(costsData);
      setHasMore(transactionsData.transactions.length === 50);
    } catch (error) {
      console.error('Failed to load AI credits data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'Charge':
        return { name: 'add-circle', color: '#34C759' };
      case 'Spend':
        return { name: 'remove-circle', color: '#FF3B30' };
      case 'Refund':
        return { name: 'return-up-back', color: '#007AFF' };
      default:
        return { name: 'help-circle', color: colors.textSecondary };
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const locale = i18n.language === 'tr' ? tr : enUS;
      return format(date, 'dd MMM yyyy, HH:mm', { locale });
    } catch {
      return dateString;
    }
  };

  const getTransactionDescription = (transaction: AICreditTransaction): string => {
    const description = transaction.description || '';
    const transactionTypeKey = transaction.transactionType.toLowerCase();
    
    // Backend'den gelen description'ları analiz et (hem Türkçe hem İngilizce)
    const lowerDescription = description.toLowerCase();
    
    // Hesap açılış kredisi
    if (lowerDescription.includes('hesap açılış') || 
        lowerDescription.includes('account opening') ||
        lowerDescription.includes('açılış kredisi')) {
      return t('aiCredits.transactionDescriptions.accountOpening');
    }
    
    // Aylık kredi yüklemesi
    if (lowerDescription.includes('aylık kredi') || 
        lowerDescription.includes('monthly credit') ||
        lowerDescription.includes('kredi yüklemesi') ||
        lowerDescription.includes('credit recharge')) {
      // Package name'i description'dan çıkar
      const packageMatch = description.match(/\(([^)]+)\)/);
      const packageName = packageMatch ? packageMatch[1] : '';
      const baseText = t('aiCredits.transactionDescriptions.monthlyRecharge');
      return packageName ? `${baseText} (${packageName})` : baseText;
    }
    
    // Operation type varsa (ProductRecognition, PriceDetection vb.)
    if (transaction.operationType) {
      const operationTypeName = t(`aiCredits.operationTypes.${transaction.operationType}`) || transaction.operationType;
      
      if (transaction.transactionType === 'Spend') {
        return t('aiCredits.transactionDescriptions.operationSpend', { operationType: operationTypeName });
      } else if (transaction.transactionType === 'Refund') {
        return t('aiCredits.transactionDescriptions.operationRefund', { operationType: operationTypeName });
      }
    }
    
    // Description'da operation type pattern'i varsa (örn: "ProductRecognition işlemi")
    if (description) {
      const operationTypeMatch = description.match(/(ProductRecognition|PriceDetection)/i);
      if (operationTypeMatch) {
        const opType = operationTypeMatch[1];
        const operationTypeName = t(`aiCredits.operationTypes.${opType}`) || opType;
        
        if (lowerDescription.includes('iade') || lowerDescription.includes('refund')) {
          return t('aiCredits.transactionDescriptions.operationRefund', { operationType: operationTypeName });
        } else if (lowerDescription.includes('işlem') || lowerDescription.includes('operation')) {
          return t('aiCredits.transactionDescriptions.operationSpend', { operationType: operationTypeName });
        }
      }
    }
    
    // Fallback: Transaction type'ı çevir
    if (transactionTypeKey === 'charge') {
      return t('aiCredits.transactionTypes.charge');
    } else if (transactionTypeKey === 'spend') {
      return t('aiCredits.transactionTypes.spend');
    } else if (transactionTypeKey === 'refund') {
      return t('aiCredits.transactionTypes.refund');
    }
    
    // Son çare: Orijinal description'ı göster
    return description || transaction.transactionType;
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ 
        backgroundColor: colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center'
      }}>
        <Pressable onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={{ 
          color: colors.text, 
          fontSize: 20, 
          fontWeight: '600'
        }}>
          {t('aiCredits.title')}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Summary Card */}
        {summary && (
          <View style={{ 
            margin: 16,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            {/* Balance */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                marginBottom: 8 
              }}>
                <Ionicons name="sparkles" size={32} color={colors.primary} />
                <Text style={{ 
                  color: colors.text, 
                  fontSize: 48, 
                  fontWeight: '700',
                  marginLeft: 8
                }}>
                  {summary.currentBalance}
                </Text>
              </View>
              <Text style={{ 
                color: colors.textSecondary, 
                fontSize: 16 
              }}>
                {t('aiCredits.availableCredits')}
              </Text>
            </View>

            {/* Stats Grid */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: colors.textSecondary, 
                  fontSize: 12,
                  marginBottom: 4
                }}>
                  {t('aiCredits.totalEarned')}
                </Text>
                <Text style={{ 
                  color: '#34C759', 
                  fontSize: 20, 
                  fontWeight: '600'
                }}>
                  +{summary.totalEarned}
                </Text>
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: colors.textSecondary, 
                  fontSize: 12,
                  marginBottom: 4
                }}>
                  {t('aiCredits.totalSpent')}
                </Text>
                <Text style={{ 
                  color: '#FF3B30', 
                  fontSize: 20, 
                  fontWeight: '600'
                }}>
                  -{summary.totalSpent}
                </Text>
              </View>
            </View>

            {/* Package Info */}
            <View style={{ 
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: 12,
              marginBottom: 16
            }}>
              <Text style={{ 
                color: colors.textSecondary, 
                fontSize: 12,
                marginBottom: 4
              }}>
                {t('aiCredits.currentPackage')}
              </Text>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
                marginBottom: 8
              }}>
                {isPremium && (
                  <Ionicons 
                    name="diamond" 
                    size={20} 
                    color="#FFD700" 
                    style={{ marginRight: 6 }} 
                  />
                )}
                <Text style={{ 
                  color: colors.text, 
                  fontSize: 16, 
                  fontWeight: '600',
                }}>
                  {(() => {
                    // Premium kullanıcıysa Premium göster
                    if (isPremium) {
                      return t('plans.premium');
                    }
                    // Package name varsa onu göster
                    if (summary.packageName) {
                      return summary.packageName;
                    }
                    // Fallback: Standard
                    return t('plans.standard');
                  })()}
                </Text>
              </View>
              <Text style={{ 
                color: colors.textSecondary, 
                fontSize: 14,
                marginBottom: (!isPremium && summary.packageName && (
                  summary.packageName.toLowerCase().includes('standard') || 
                  summary.packageName.toLowerCase().includes('standart')
                )) ? 12 : 0
              }}>
                {(() => {
                  // Premium kullanıcıysa planDetails'den monthly credits al
                  if (isPremium && planDetails?.monthlyAICredits) {
                    return `${planDetails.monthlyAICredits} ${t('aiCredits.creditsPerMonth')}`;
                  }
                  // Standard kullanıcılar için summary'den al
                  return `${summary.monthlyCredits} ${t('aiCredits.creditsPerMonth')}`;
                })()}
              </Text>
              
              {/* Upgrade to Premium Button (only for Standard plan and non-premium users) */}
              {!isPremium && summary.packageName && (
                summary.packageName.toLowerCase().includes('standard') || 
                summary.packageName.toLowerCase().includes('standart')
              ) ? (
                <Pressable
                  onPress={() => navigation.navigate('Plans')}
                  style={({ pressed }) => ({
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                    opacity: pressed ? 0.8 : 1,
                    minHeight: 44,
                  })}
                >
                  <Ionicons name="star" size={18} color="white" style={{ marginRight: 8 }} />
                  <Text style={{
                    color: 'white',
                    fontSize: 15,
                    fontWeight: '700',
                    textAlign: 'center',
                  }}>
                    {t('plans.upgradeToPremium') || (i18n.language === 'tr' ? "Premium'a Yükselt" : "Upgrade to Premium")}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Next Recharge */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Text style={{ 
                color: colors.textSecondary, 
                fontSize: 14
              }}>
                {t('aiCredits.nextRechargeIn')}
              </Text>
              <Text style={{ 
                color: colors.primary, 
                fontSize: 14,
                fontWeight: '600'
              }}>
                {summary.daysUntilNextRecharge} {t('aiCredits.days')}
              </Text>
            </View>
          </View>
        )}

        {/* Operation Costs */}
        {operationCosts.length > 0 && (
          <View style={{ 
            margin: 16,
            marginTop: 0,
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{ 
              color: colors.text, 
              fontSize: 18, 
              fontWeight: '600',
              marginBottom: 12
            }}>
              {t('aiCredits.aiOperationCosts')}
            </Text>
            
            {operationCosts.map((cost, index) => (
              <View 
                key={cost.id}
                style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 15,
                    marginBottom: 2
                  }}>
                    {t(`aiCredits.operationTypes.${cost.operationType}`) || cost.operationType}
                  </Text>
                  <Text style={{ 
                    color: colors.textSecondary, 
                    fontSize: 12
                  }}>
                    {t(`aiCredits.operationDescriptions.${cost.operationType}`) || cost.description || ''}
                  </Text>
                </View>
                
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center',
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6
                }}>
                  <Ionicons name="sparkles" size={14} color={colors.primary} />
                  <Text style={{ 
                    color: colors.text, 
                    fontSize: 14,
                    fontWeight: '600',
                    marginLeft: 4
                  }}>
                    {cost.creditCost}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Transaction History */}
        <View style={{ 
          margin: 16,
          marginTop: 0,
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Text style={{ 
            color: colors.text, 
            fontSize: 18, 
            fontWeight: '600',
            marginBottom: 12
          }}>
            {t('aiCredits.transactionHistory')}
          </Text>
          
          {transactions.length === 0 ? (
            <Text style={{ 
              color: colors.textSecondary, 
              fontSize: 14,
              textAlign: 'center',
              paddingVertical: 20
            }}>
              {t('aiCredits.noTransactions')}
            </Text>
          ) : (
            transactions.map((transaction, index) => {
              const icon = getTransactionIcon(transaction.transactionType);
              return (
                <View 
                  key={transaction.id}
                  style={{ 
                    flexDirection: 'row', 
                    paddingVertical: 12,
                    borderTopWidth: index > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ marginRight: 12, paddingTop: 2 }}>
                    <Ionicons name={icon.name as any} size={24} color={icon.color} />
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      color: colors.text, 
                      fontSize: 15,
                      marginBottom: 2
                    }}>
                      {getTransactionDescription(transaction)}
                    </Text>
                    <Text style={{ 
                      color: colors.textSecondary, 
                      fontSize: 12
                    }}>
                      {formatDate(transaction.createdAt)}
                    </Text>
                  </View>
                  
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ 
                      color: transaction.amount > 0 ? '#34C759' : '#FF3B30', 
                      fontSize: 16,
                      fontWeight: '600',
                      marginBottom: 2
                    }}>
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                    </Text>
                    <Text style={{ 
                      color: colors.textSecondary, 
                      fontSize: 12
                    }}>
                      {t('aiCredits.balance')}: {transaction.balanceAfter}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

