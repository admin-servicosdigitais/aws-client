import type {
  CreateIndexOptions,
  IndexInfo,
  IndexMappings,
  SearchQuery,
  SearchResult,
} from "../types/opensearch.types.js";

export interface IOpenSearchClient {
  createIndex(indexName: string, options?: CreateIndexOptions): Promise<void>;
  deleteIndex(indexName: string): Promise<void>;
  indexExists(indexName: string): Promise<boolean>;
  getIndexInfo(indexName?: string): Promise<IndexInfo[]>;
  putMapping(indexName: string, mappings: IndexMappings): Promise<void>;

  search<T>(indexName: string, query: SearchQuery): Promise<SearchResult<T>>;
  count(indexName: string, query?: Pick<SearchQuery, "query">): Promise<number>;
}
