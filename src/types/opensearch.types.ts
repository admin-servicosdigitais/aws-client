export type MappingProperty =
  | { type: "text"; analyzer?: string }
  | { type: "keyword" }
  | { type: "integer" | "long" | "float" | "double" }
  | { type: "boolean" }
  | { type: "date"; format?: string }
  | { type: "binary" }
  | { type: "dense_vector"; dims: number; similarity?: "cosine" | "l2_norm" | "dot_product" }
  | { type: "object"; properties?: Record<string, MappingProperty> }
  | { type: "nested"; properties?: Record<string, MappingProperty> };

export interface IndexSettings {
  numberOfShards?: number;
  numberOfReplicas?: number;
  refreshInterval?: string;
  maxResultWindow?: number;
  analysis?: Record<string, unknown>;
}

export interface IndexMappings {
  properties: Record<string, MappingProperty>;
}

export interface CreateIndexOptions {
  mappings?: IndexMappings;
  settings?: IndexSettings;
}

export interface IndexInfo {
  index: string;
  health: "green" | "yellow" | "red";
  status: "open" | "close";
  docsCount: number;
  docsDeleted: number;
  storeSize: string;
}

export interface IndexDocumentOptions {
  id?: string;
  routing?: string;
  refresh?: "true" | "false" | "wait_for";
}

export interface BulkOperation<T> {
  action: "index" | "create" | "update" | "delete";
  id?: string;
  routing?: string;
  document?: T;
  updateScript?: string;
}

export interface BulkResultItem {
  action: string;
  id: string;
  status: number;
  error?: { type: string; reason: string };
}

export interface BulkResult {
  took: number;
  errors: boolean;
  items: BulkResultItem[];
}

export interface SearchQuery {
  query?: Record<string, unknown>;
  knn?: {
    field: string;
    queryVector: number[];
    k: number;
  };
  aggs?: Record<string, unknown>;
  sort?: Array<Record<string, unknown>>;
  _source?: string[] | boolean;
  from?: number;
  size?: number;
  highlight?: Record<string, unknown>;
  searchAfter?: unknown[];
}

export interface SearchHit<T> {
  id: string;
  score: number | null;
  source: T;
  highlight?: Record<string, string[]>;
  sort?: unknown[];
}

export interface SearchTotal {
  value: number;
  relation: "eq" | "gte";
}

export interface SearchResult<T> {
  total: SearchTotal;
  hits: SearchHit<T>[];
  aggregations?: Record<string, unknown>;
  took: number;
  timedOut: boolean;
}

export interface UpdateDocumentOptions {
  retryOnConflict?: number;
  refresh?: "true" | "false" | "wait_for";
}

export interface ScrollResult<T> {
  scrollId: string;
  result: SearchResult<T>;
  done: boolean;
}
