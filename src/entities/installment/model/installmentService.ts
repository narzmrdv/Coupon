import type {
  CalculateInstallmentInput,
  CreateInstallmentInput,
  Installment,
  InstallmentCalculation,
  InstallmentPayment,
  InstallmentPaymentLink,
} from '@/shared/types/installment';
import { apiClient } from '@/shared/lib/api/apiClient';
import { API_CONFIG } from '@/shared/config/api';

export interface InstallmentRepository {
  calculate(input: CalculateInstallmentInput): Promise<InstallmentCalculation>;
  getInstallments(): Promise<Installment[]>;
  getInstallmentById(id: string): Promise<Installment | undefined>;
  createInstallment(input: CreateInstallmentInput): Promise<Installment>;
  getPaymentById(
    installmentId: string,
    paymentId: string,
  ): Promise<InstallmentPayment | undefined>;
  /** Pay a specific scheduled payment from the plan. */
  payInstallmentPayment(
    installmentId: string,
    paymentId: string,
  ): Promise<InstallmentPaymentLink>;
  /** Pay an arbitrary amount against the remaining balance, outside the
   *  fixed schedule (the "Внести платёж" flow). */
  payCustomAmount(installmentId: string, amount: number): Promise<InstallmentPaymentLink>;
  /** Pay off the entire remaining balance at once ("Погасить досрочно"). */
  payoffInstallment(installmentId: string): Promise<InstallmentPaymentLink>;
}

// This backend has repeatedly sent numeric fields as strings (see bonus
// balance) and incomplete payloads — normalize once here so every screen
// gets a safe, consistent shape regardless of what the API actually sends.
function normalizePayment(payment: Partial<InstallmentPayment>): InstallmentPayment {
  return {
    id: String(payment.id ?? ''),
    installmentId: String(payment.installmentId ?? ''),
    sequenceNumber: Number(payment.sequenceNumber) || 0,
    amount: Number(payment.amount) || 0,
    dueDate: payment.dueDate ?? '',
    status: payment.status ?? 'pending',
    paidAt: payment.paidAt,
    orderReference: payment.orderReference,
    label: payment.label,
  };
}

function normalizeInstallment(installment: Partial<Installment>): Installment {
  return {
    id: String(installment.id ?? ''),
    tourId: installment.tourId,
    type: installment.type ?? 'flex',
    baseAmount: Number(installment.baseAmount) || 0,
    totalAmount: Number(installment.totalAmount) || 0,
    currency: installment.currency ?? 'EUR',
    surchargePercent: Number(installment.surchargePercent) || 0,
    firstPayment: Number(installment.firstPayment) || 0,
    tourDate: installment.tourDate ?? '',
    paymentDeadline: installment.paymentDeadline ?? '',
    paidAmount: Number(installment.paidAmount) || 0,
    remainingAmount: Number(installment.remainingAmount) || 0,
    status: installment.status ?? 'active',
    payments: Array.isArray(installment.payments)
      ? installment.payments.map(normalizePayment)
      : [],
  };
}

class RemoteInstallmentRepository implements InstallmentRepository {
  async calculate(input: CalculateInstallmentInput): Promise<InstallmentCalculation> {
    return apiClient.post<InstallmentCalculation>(API_CONFIG.ENDPOINTS.INSTALLMENTS.CALCULATE, {
      type: 'flex',
      baseAmount: input.baseAmount,
      currency: 'EUR',
      tourDate: input.tourDate,
      firstPayment: input.firstPayment,
    });
  }

  async getInstallments(): Promise<Installment[]> {
    const data = await apiClient.get<Installment[]>(API_CONFIG.ENDPOINTS.INSTALLMENTS.LIST);
    return Array.isArray(data) ? data.map(normalizeInstallment) : [];
  }

  async getInstallmentById(id: string): Promise<Installment | undefined> {
    try {
      const data = await apiClient.get<Installment>(API_CONFIG.ENDPOINTS.INSTALLMENTS.BY_ID(id));
      return normalizeInstallment(data);
    } catch {
      return undefined;
    }
  }

  async createInstallment(input: CreateInstallmentInput): Promise<Installment> {
    const data = await apiClient.post<Installment>(API_CONFIG.ENDPOINTS.INSTALLMENTS.CREATE, {
      type: 'flex',
      tourId: input.tourId,
      baseAmount: input.baseAmount,
      currency: 'EUR',
      tourDate: input.tourDate,
      firstPayment: input.firstPayment,
    });
    return normalizeInstallment(data);
  }

  async getPaymentById(
    installmentId: string,
    paymentId: string,
  ): Promise<InstallmentPayment | undefined> {
    const installment = await this.getInstallmentById(installmentId);
    return installment?.payments.find((payment) => payment.id === paymentId);
  }

  async payInstallmentPayment(
    installmentId: string,
    paymentId: string,
  ): Promise<InstallmentPaymentLink> {
    return apiClient.post<InstallmentPaymentLink>(
      API_CONFIG.ENDPOINTS.INSTALLMENTS.PAY(installmentId, paymentId),
    );
  }

  async payCustomAmount(installmentId: string, amount: number): Promise<InstallmentPaymentLink> {
    return apiClient.post<InstallmentPaymentLink>(
      API_CONFIG.ENDPOINTS.INSTALLMENTS.PAY_CUSTOM(installmentId),
      { amount },
    );
  }

  async payoffInstallment(installmentId: string): Promise<InstallmentPaymentLink> {
    return apiClient.post<InstallmentPaymentLink>(
      API_CONFIG.ENDPOINTS.INSTALLMENTS.PAYOFF(installmentId),
    );
  }
}

export const installmentService: InstallmentRepository = new RemoteInstallmentRepository();
