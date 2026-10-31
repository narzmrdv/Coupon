import { apiClient } from '../../../shared/lib/api/apiClient';
import { API_CONFIG } from '../../../shared/config/api';
import { Tour, CreateTourDto, UpdateTourDto } from '../../../shared/types/tour';
import type {
  InstallmentPaymentLink,
  TourPaymentInput,
} from '../../../shared/types/installment';

class TourService {
  async getAllTours(): Promise<Tour[]> {
    return apiClient.get<Tour[]>(API_CONFIG.ENDPOINTS.TOURS);
  }

  async getTourById(id: number): Promise<Tour> {
    return apiClient.get<Tour>(API_CONFIG.ENDPOINTS.TOURS_BY_ID(id));
  }

  /** "Оплатить тур" — full payment in EUR, no installment plan. */
  async payForTour(input: TourPaymentInput): Promise<InstallmentPaymentLink> {
    return apiClient.post<InstallmentPaymentLink>(API_CONFIG.ENDPOINTS.TOUR_PAYMENT, {
      tourId: input.tourId,
      baseAmount: input.baseAmount,
      currency: 'EUR',
    });
  }
}

export const tourService = new TourService();
