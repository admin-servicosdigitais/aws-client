import type { ReturnValue, Select } from "@aws-sdk/client-dynamodb";

export type DynamoItem = Record<string, unknown>;

export type DynamoKey = Record<string, string | number | Uint8Array>;

export interface PutItemOptions {
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: DynamoItem;
  returnValues?: ReturnValue;
}

export interface GetItemOptions {
  consistentRead?: boolean;
  projectionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
}

export interface UpdateItemOptions {
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: DynamoItem;
  returnValues?: ReturnValue;
}

export interface DeleteItemOptions {
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: DynamoItem;
  returnValues?: ReturnValue;
}

export interface QueryOptions {
  indexName?: string;
  filterExpression?: string;
  projectionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: DynamoItem;
  scanIndexForward?: boolean;
  limit?: number;
  exclusiveStartKey?: DynamoKey;
  consistentRead?: boolean;
  select?: Select;
}

export interface QueryResult<T extends DynamoItem> {
  items: T[];
  count: number;
  scannedCount: number;
  lastEvaluatedKey?: DynamoKey;
}

export interface ScanOptions {
  indexName?: string;
  filterExpression?: string;
  projectionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: DynamoItem;
  limit?: number;
  exclusiveStartKey?: DynamoKey;
  segment?: number;
  totalSegments?: number;
}

export interface TransactWriteItem {
  type: "Put" | "Update" | "Delete" | "ConditionCheck";
  tableName: string;
  key?: DynamoKey;
  item?: DynamoItem;
  updateExpression?: string;
  conditionExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: DynamoItem;
}
