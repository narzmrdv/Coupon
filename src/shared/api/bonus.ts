// Re-export from entities for backwards compatibility
export { bonusApi } from '@/entities/bonus';
export type {
  CanWatchAdResponse,
  TransactionsResponse,
  MaxDiscountResponse,
  ApplyBonusDto,
  EarnReferralDto,
  UploadResponse,
} from '@/entities/bonus';
export type {
  BonusBalance,
  BonusLimits,
  BonusTransaction,
} from '@/shared/types/bonus';
