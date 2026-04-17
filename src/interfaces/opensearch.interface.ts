import type {
  BulkOperation,
  BulkResult,
  CreateIndexOptions,
  IndexDocumentOptions,
  IndexInfo,
  IndexMappings,
  ScrollResult,
  SearchQuery,
  SearchResult,
  UpdateDocumentOptions,
} from "../types/opensearch.types.js";

export interface IOpenSearchClient {
  // --- Índices ---
  createIndex(indexName: string, options?: CreateIndexOptions): Promise<void>;
  deleteIndex(indexName: string): Promise<void>;
  indexExists(indexName: string): Promise<boolean>;
  getIndexInfo(indexName?: string): Promise<IndexInfo[]>;
  putMapping(indexName: string, mappings: IndexMappings): Promise<void>;

  // --- Documentos ---
  indexDocument<T extends Record<string, unknown>>(
    indexName: string,
    document: T,
    options?: IndexDocumentOptions
  ): Promise<string>;
  getDocument<T>(indexName: string, id: string): Promise<T | null>;
  updateDocument<T extends Record<string, unknown>>(
    indexName: string,
    id: string,
    partial: Partial<T>,
    options?: UpdateDocumentOptions
  ): Promise<void>;
  deleteDocument(indexName: string, id: string): Promise<void>;

  // --- Bulk / Search ---
  bulk<T extends Record<string, unknown>>(indexName: string, operations: BulkOperation<T>[]): Promise<BulkResult>;
  search<T>(indexName: string, query: SearchQuery): Promise<SearchResult<T>>;
  count(indexName: string, query?: Pick<SearchQuery, "query">): Promise<number>;
  scroll<T>(
    indexName: string,
    query: SearchQuery,
    scrollId: string | null,
    scrollTtl?: string
  ): Promise<ScrollResult<T>>;
}
