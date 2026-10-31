export interface Tour {
  id: number;
  title: string;
  description: string;
  price: number;
  duration: string;
  location: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTourDto {
  title: string;
  description: string;
  price: number;
  duration: string;
  location: string;
  imageUrl: string;
}

export interface UpdateTourDto {
  title?: string;
  description?: string;
  price?: number;
  duration?: string;
  location?: string;
  imageUrl?: string;
  isActive?: boolean;
}
