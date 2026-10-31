export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: number;
  email: string;
  balance: number;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserBalanceDto {
  amount: number;
}

export interface SetUserBalanceDto {
  amount: number;
}

export interface UpdateUserRoleDto {
  role: UserRole;
}

export interface BalanceResponse {
  balance: number;
}

export interface UserBalanceResponse {
  userId: number;
  balance: number;
}
