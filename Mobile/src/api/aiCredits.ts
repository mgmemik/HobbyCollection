import axios from './interceptor';

export interface AIOperationCost {
  id: number;
  operationType: string;
  description: string;
  creditCost: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserCreditSummary {
  currentBalance: number;
  totalEarned: number;
  totalSpent: number;
  lastRechargeDate: string;
  nextRechargeDate: string;
  packageName: string;
  monthlyCredits: number;
  daysUntilNextRecharge: number;
}

export interface AICreditTransaction {
  id: number;
  userId: string;
  transactionType: string; // "Charge", "Spend", "Refund"
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  operationType?: string;
  description?: string;
  productId?: number;
  isSuccessful: boolean;
  createdAt: string;
}

export interface TransactionsResponse {
  transactions: AICreditTransaction[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Kullanıcının AI kredi bakiyesini getirir
 */
export const getUserBalance = async (): Promise<number> => {
  const response = await axios.get<{ balance: number }>('/api/AICredits/balance');
  return response.data.balance;
};

/**
 * Kullanıcının AI kredi özetini getirir
 */
export const getUserCreditSummary = async (): Promise<UserCreditSummary> => {
  const response = await axios.get<UserCreditSummary>('/api/AICredits/summary');
  return response.data;
};

/**
 * Kullanıcının işlem geçmişini getirir
 */
export const getUserTransactions = async (
  page: number = 1,
  pageSize: number = 50
): Promise<TransactionsResponse> => {
  const response = await axios.get<TransactionsResponse>('/api/AICredits/transactions', {
    params: { page, pageSize },
  });
  return response.data;
};

/**
 * AI işlem maliyetlerini getirir
 */
export const getOperationCosts = async (): Promise<AIOperationCost[]> => {
  const response = await axios.get<AIOperationCost[]>('/api/AICredits/operation-costs');
  return response.data;
};

/**
 * Belirli bir işlem için yeterli kredi olup olmadığını kontrol eder
 */
export const checkSufficientCredits = async (
  operationType: string
): Promise<{ hasSufficient: boolean; currentBalance: number }> => {
  const response = await axios.get<{ hasSufficient: boolean; currentBalance: number }>(
    '/api/AICredits/check-sufficient',
    {
      params: { operationType },
    }
  );
  return response.data;
};

// İşlem tipleri
export const AIOperationType = {
  ProductRecognition: 'ProductRecognition',
  PriceDetection: 'PriceDetection',
} as const;

// Transaction tipleri
export const TransactionType = {
  Charge: 'Charge',
  Spend: 'Spend',
  Refund: 'Refund',
} as const;

