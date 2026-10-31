import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentService } from '../../../entities/document/model/documentService';

export const DOCUMENT_KEYS = {
  all: ['documents'] as const,
  detail: (id: string) => ['documents', id] as const,
};

// ===== Queries =====
export const useDocuments = () => {
  return useQuery({
    queryKey: DOCUMENT_KEYS.all,
    queryFn: () => documentService.getMyDocuments(),
    staleTime: 2 * 60 * 1000, // 2 минуты
  });
};

export const useDocument = (id: string) => {
  return useQuery({
    queryKey: DOCUMENT_KEYS.detail(id),
    queryFn: () => documentService.getDocumentById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
};

// ===== Mutations =====
export const useUploadDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, onProgress }: { file: any; onProgress?: (progress: number) => void }) =>
      documentService.uploadDocument(file, onProgress),
    onSuccess: () => {
      // Перезагружаем список документов после загрузки
      queryClient.invalidateQueries({ queryKey: DOCUMENT_KEYS.all });
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => documentService.deleteDocument(id),
    onSuccess: (_, deletedId) => {
      // Оптимистичное удаление из кеша
      queryClient.invalidateQueries({ queryKey: DOCUMENT_KEYS.all });
      queryClient.removeQueries({ queryKey: DOCUMENT_KEYS.detail(deletedId) });
    },
  });
};
