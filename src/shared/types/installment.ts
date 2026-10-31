export type InstallmentCurrency = 'USD' | 'UAH' | 'EUR';

/** `flex` is the current unified plan (this app only ever creates this type
 *  now). `standard` and `30_70` are legacy types from before this redesign —
 *  the backend still returns and accepts payments for any of these that
 *  already exist, so old records must not break just because their shape
 *  is missing some `flex`-only fields (tourDate/surchargePercent/etc. may
 *  come back empty for them — the normalizer below defaults those safely). */
export type InstallmentType = 'standard' | '30_70' | 'flex';

export type InstallmentStatus = 'active' | 'completed' | 'overdue' | 'cancelled';

export type InstallmentPaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

/** All monetary values are integer minor units (for example, cents). */
export interface InstallmentPayment {
  id: string;
  installmentId: string;
  sequenceNumber: number;
  amount: number;
  dueDate: string;
  status: InstallmentPaymentStatus;
  paidAt?: string;
  orderReference?: string;
  label?: string;
}

/** Single unified installment plan: user picks the tour amount, the
 *  departure date, and a first payment (min 30% of baseAmount). The backend
 *  derives the interest rate from how much time is left before the
 *  tourDate-minus-21-days deadline, and spreads the remainder across
 *  regular monthly payments. All monetary values are integer minor units. */
export interface Installment {
  id: string;
  tourId?: number;
  type: InstallmentType;
  baseAmount: number;
  totalAmount: number;
  currency: InstallmentCurrency;
  surchargePercent: number;
  firstPayment: number;
  /** ISO date, `YYYY-MM-DD`. */
  tourDate: string;
  /** ISO date, `YYYY-MM-DD` — tourDate minus 21 days; the whole balance must
   *  be paid off by this date. */
  paymentDeadline: string;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  payments: InstallmentPayment[];
}

export interface InstallmentCalculation {
  type: InstallmentType;
  baseAmount: number;
  totalAmount: number;
  currency: InstallmentCurrency;
  surchargePercent: number;
  firstPayment: number;
  tourDate: string;
  paymentDeadline: string;
  /** Days between today and paymentDeadline — informational, drives the
   *  backend's interest tier. Not currently displayed. */
  repaymentDays?: number;
  payments: {
    sequenceNumber: number;
    amount: number;
    dueDate: string;
    label: string;
  }[];
}

export interface CalculateInstallmentInput {
  baseAmount: number;
  /** ISO date, `YYYY-MM-DD`. */
  tourDate: string;
  /** Minor units — must be >= 30% of baseAmount; the backend rejects (400)
   *  anything less. */
  firstPayment: number;
}

export interface CreateInstallmentInput {
  tourId?: number;
  baseAmount: number;
  tourDate: string;
  firstPayment: number;
}

export interface InstallmentPaymentLink {
  paymentUrl: string;
  orderReference: string;
}

/** "Оплатить тур" — a one-off full payment, not an installment. */
export interface TourPaymentInput {
  tourId?: number;
  baseAmount: number;
}
