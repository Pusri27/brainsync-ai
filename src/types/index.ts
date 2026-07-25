export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface DocumentItem {
  id: string;
  title: string;
  filePath: string;
  fileType: string;
  fileSize?: string;
  status: DocumentStatus;
  chunksCount: number;
  createdAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId?: string;
  documentTitle: string;
  content: string;
  similarityScore: number;
  pageNumber?: number;
  sourceType?: 'document' | 'web' | 'url';
  url?: string;
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: DocumentChunk[];
}

export type ActiveTab = 'dashboard' | 'documents' | 'chat' | 'graph' | 'analytics';

