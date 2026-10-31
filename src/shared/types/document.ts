export interface Document {
  id: string;
  userId: number;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface DocumentWithUser extends Document {
  user: {
    id: number;
    email: string;
  };
}

export interface UploadDocumentResponse extends Document {}

export interface DeleteDocumentResponse {
  message: string;
}
