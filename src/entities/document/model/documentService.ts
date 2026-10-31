import { apiClient } from '../../../shared/lib/api/apiClient';
import { API_CONFIG } from '../../../shared/config/api';
import {
  Document,
  UploadDocumentResponse,
  DeleteDocumentResponse,
} from '../../../shared/types/document';

class DocumentService {
  async uploadDocument(
    file: any,
    onProgress?: (progress: number) => void
  ): Promise<UploadDocumentResponse> {
    return apiClient.uploadFile<UploadDocumentResponse>(
      API_CONFIG.ENDPOINTS.DOCUMENTS_UPLOAD,
      file,
      onProgress
    );
  }

  async getMyDocuments(): Promise<Document[]> {
    return apiClient.get<Document[]>(API_CONFIG.ENDPOINTS.DOCUMENTS);
  }

  async getDocumentById(id: string): Promise<Document> {
    return apiClient.get<Document>(API_CONFIG.ENDPOINTS.DOCUMENTS_BY_ID(id));
  }

  async deleteDocument(id: string): Promise<DeleteDocumentResponse> {
    return apiClient.delete<DeleteDocumentResponse>(API_CONFIG.ENDPOINTS.DOCUMENTS_BY_ID(id));
  }
}

export const documentService = new DocumentService();
