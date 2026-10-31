import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tourService } from '../../../entities/tour/model/tourService';

export const TOUR_KEYS = {
  all: ['tours'] as const,
  detail: (id: number) => ['tours', id] as const,
};

// ===== Queries =====
export const useTours = () => {
  return useQuery({
    queryKey: TOUR_KEYS.all,
    queryFn: () => tourService.getAllTours(),
    staleTime: 5 * 60 * 1000, // 5 минут
  });
};

export const useTour = (id: number) => {
  return useQuery({
    queryKey: TOUR_KEYS.detail(id),
    queryFn: () => tourService.getTourById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
};

// Prefetch функция для предзагрузки данных
export const usePrefetchTour = () => {
  const queryClient = useQueryClient();

  return (id: number) => {
    queryClient.prefetchQuery({
      queryKey: TOUR_KEYS.detail(id),
      queryFn: () => tourService.getTourById(id),
    });
  };
};
