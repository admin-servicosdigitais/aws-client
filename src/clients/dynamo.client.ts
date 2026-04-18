import type { DynamoDBClient as DynamoSDKClient } from "@aws-sdk/client-dynamodb";
import type { IDynamoClient } from "../interfaces/dynamo.interface.js";
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
import { NotImplementedError } from "../errors/aws-client.error.js";

export class DynamoClientImpl implements IDynamoClient {
  constructor(
    private readonly sdk: DynamoSDKClient,
    private readonly tableName: string,
  ) {}

  putItem<T extends DynamoItem>(_item: T, _options?: PutItemOptions): Promise<void> {
    throw new NotImplementedError("DynamoClientImpl.putItem");
  }

  getItem<T extends DynamoItem>(_key: DynamoKey, _options?: GetItemOptions): Promise<T | null> {
    throw new NotImplementedError("DynamoClientImpl.getItem");
  }

  updateItem(_key: DynamoKey, _updateExpression: string, _options?: UpdateItemOptions): Promise<DynamoItem | null> {
    throw new NotImplementedError("DynamoClientImpl.updateItem");
  }

  deleteItem(_key: DynamoKey, _options?: DeleteItemOptions): Promise<void> {
    throw new NotImplementedError("DynamoClientImpl.deleteItem");
  }

  batchGetItems<T extends DynamoItem>(_keys: DynamoKey[]): Promise<T[]> {
    throw new NotImplementedError("DynamoClientImpl.batchGetItems");
  }

  batchWriteItems(_puts?: DynamoItem[], _deletes?: DynamoKey[]): Promise<void> {
    throw new NotImplementedError("DynamoClientImpl.batchWriteItems");
  }

  query<T extends DynamoItem>(_keyConditionExpression: string, _options?: QueryOptions): Promise<QueryResult<T>> {
    throw new NotImplementedError("DynamoClientImpl.query");
  }

  scan<T extends DynamoItem>(_options?: ScanOptions): Promise<QueryResult<T>> {
    throw new NotImplementedError("DynamoClientImpl.scan");
  }

  transactWrite(_items: TransactWriteItem[]): Promise<void> {
    throw new NotImplementedError("DynamoClientImpl.transactWrite");
  }

  transactGet<T extends DynamoItem>(
    _requests: Array<{ tableName: string; key: DynamoKey }>,
  ): Promise<(T | null)[]> {
    throw new NotImplementedError("DynamoClientImpl.transactGet");
  }
}
