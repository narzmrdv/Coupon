import { apiClient } from '@/shared/lib/api/apiClient';
import { API_CONFIG } from '@/shared/config/api';

export interface CreatePaymentRequest {
  amount: number;
  currency: 'USD' | 'UAH' | 'EUR';
  bonusPercent: number;
  language?: 'RU' | 'UA' | 'EN';
}

export interface CreatePaymentResponse {
  paymentUrl: string;
  orderReference: string;
}

export interface PaymentStatusResponse {
  orderReference: string;
  transactionStatus: 'Approved' | 'Declined' | 'Expired' | 'Refunded' | 'Pending';
  amount: number;
  currency: string;
  twaAwarded?: number;
}

class PaymentApi {
  async createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return apiClient.post<CreatePaymentResponse>(
      API_CONFIG.ENDPOINTS.PAYMENTS.CREATE,
      data,
    );
  }

  async getPaymentStatus(orderReference: string): Promise<PaymentStatusResponse> {
    return apiClient.get<PaymentStatusResponse>(
      API_CONFIG.ENDPOINTS.PAYMENTS.STATUS(orderReference),
    );
  }
}

export const paymentApi = new PaymentApi();
