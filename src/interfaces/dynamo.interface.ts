import type {
  DeleteItemOptions,
  DynamoItem,
  DynamoKey,
  GetItemOptions,
  PutItemOptions,
  QueryOptions,
  QueryResult,
  ScanOptions,
  TransactWriteItem,
  UpdateItemOptions,
} from "../types/dynamo.types.js";

export interface IDynamoClient {
  putItem<T extends DynamoItem>(item: T, options?: PutItemOptions): Promise<void>;
  getItem<T extends DynamoItem>(key: DynamoKey, options?: GetItemOptions): Promise<T | null>;
  updateItem(key: DynamoKey, updateExpression: string, options?: UpdateItemOptions): Promise<DynamoItem | null>;
  deleteItem(key: DynamoKey, options?: DeleteItemOptions): Promise<void>;

  batchGetItems<T extends DynamoItem>(keys: DynamoKey[]): Promise<T[]>;
  batchWriteItems(puts?: DynamoItem[], deletes?: DynamoKey[]): Promise<void>;

  query<T extends DynamoItem>(keyConditionExpression: string, options?: QueryOptions): Promise<QueryResult<T>>;
  scan<T extends DynamoItem>(options?: ScanOptions): Promise<QueryResult<T>>;

  transactWrite(items: TransactWriteItem[]): Promise<void>;
  transactGet<T extends DynamoItem>(
    requests: Array<{ tableName: string; key: DynamoKey }>
  ): Promise<(T | null)[]>;
}
