import { apiClient } from '../../../shared/lib/api/apiClient';
import { API_CONFIG } from '../../../shared/config/api';
import {
  User,
  BalanceResponse,
  UpdateUserBalanceDto,
  SetUserBalanceDto,
} from '../../../shared/types/user';

class UserService {
  async getBalance(): Promise<BalanceResponse> {
    return apiClient.get<BalanceResponse>(API_CONFIG.ENDPOINTS.USERS_BALANCE);
  }

  async addBalance(data: UpdateUserBalanceDto): Promise<BalanceResponse> {
    return apiClient.post<BalanceResponse>(API_CONFIG.ENDPOINTS.USERS_BALANCE_ADD, data);
  }

  async setBalance(data: SetUserBalanceDto): Promise<BalanceResponse> {
    return apiClient.post<BalanceResponse>(API_CONFIG.ENDPOINTS.USERS_BALANCE_SET, data);
  }
}

export const userService = new UserService();
