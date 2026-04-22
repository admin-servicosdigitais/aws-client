import {
  BatchGetItemCommand,
  BatchWriteItemCommand,
  type BatchWriteItemCommandOutput,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  TransactGetItemsCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
  type AttributeValue,
  type DynamoDBClient as DynamoSDKClient,
  type TransactGetItem,
  type TransactWriteItem as AwsTransactWriteItem,
  type WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
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
import { AwsClientError } from "../errors/aws-client.error.js";
import { toAwsClientError } from "../internal/utils/error.util.js";

const DEFAULT_MAX_BATCH_RETRIES = 10;

export class DynamoClientImpl implements IDynamoClient {
  constructor(
    private readonly sdk: DynamoSDKClient,
    private readonly tableName: string,
  ) {}

  putItem<T extends DynamoItem>(item: T, options?: PutItemOptions): Promise<void> {
    return this.executeWithErrorMapping("DynamoClientImpl.putItem", async () => {
      await this.sdk.send(new PutItemCommand({
        TableName: this.tableName,
        Item: this.toAttributeMap(item),
        ConditionExpression: options?.conditionExpression,
        ExpressionAttributeNames: options?.expressionAttributeNames,
        ExpressionAttributeValues: this.toExpressionAttributeValues(options?.expressionAttributeValues),
        ReturnValues: options?.returnValues,
      }));
    });
  }

  getItem<T extends DynamoItem>(key: DynamoKey, options?: GetItemOptions): Promise<T | null> {
    return this.executeWithErrorMapping("DynamoClientImpl.getItem", async () => {
      const output = await this.sdk.send(new GetItemCommand({
        TableName: this.tableName,
        Key: this.toAttributeMap(key),
        ConsistentRead: options?.consistentRead,
        ProjectionExpression: options?.projectionExpression,
        ExpressionAttributeNames: options?.expressionAttributeNames,
      }));

      if (!output.Item) {
        return null;
      }

      return this.fromAttributeMap<T>(output.Item);
    });
  }

  updateItem(key: DynamoKey, updateExpression: string, options?: UpdateItemOptions): Promise<DynamoItem | null> {
    return this.executeWithErrorMapping("DynamoClientImpl.updateItem", async () => {
      const output = await this.sdk.send(new UpdateItemCommand({
        TableName: this.tableName,
        Key: this.toAttributeMap(key),
        UpdateExpression: updateExpression,
        ConditionExpression: options?.conditionExpression,
        ExpressionAttributeNames: options?.expressionAttributeNames,
        ExpressionAttributeValues: this.toExpressionAttributeValues(options?.expressionAttributeValues),
        ReturnValues: options?.returnValues,
      }));

      if (!output.Attributes) {
        return null;
      }

      return this.fromAttributeMap(output.Attributes);
    });
  }

  deleteItem(key: DynamoKey, options?: DeleteItemOptions): Promise<void> {
    return this.executeWithErrorMapping("DynamoClientImpl.deleteItem", async () => {
      await this.sdk.send(new DeleteItemCommand({
        TableName: this.tableName,
        Key: this.toAttributeMap(key),
        ConditionExpression: options?.conditionExpression,
        ExpressionAttributeNames: options?.expressionAttributeNames,
        ExpressionAttributeValues: this.toExpressionAttributeValues(options?.expressionAttributeValues),
        ReturnValues: options?.returnValues,
      }));
    });
  }

  batchGetItems<T extends DynamoItem>(keys: DynamoKey[]): Promise<T[]> {
    return this.executeWithErrorMapping("DynamoClientImpl.batchGetItems", async () => {
      if (keys.length === 0) {
        return [];
      }

      const allItems: T[] = [];
      let pendingKeys = keys;
      let attempt = 0;

      while (pendingKeys.length > 0) {
        const output = await this.sdk.send(new BatchGetItemCommand({
          RequestItems: {
            [this.tableName]: {
              Keys: pendingKeys.map((key) => this.toAttributeMap(key)),
            },
          },
        }));

        const items = output.Responses?.[this.tableName] ?? [];
        allItems.push(...items.map((item) => this.fromAttributeMap<T>(item)));

        const unprocessedKeys = output.UnprocessedKeys?.[this.tableName]?.Keys ?? [];
        pendingKeys = unprocessedKeys.map((key) => this.fromAttributeMap<DynamoKey>(key));

        attempt += 1;
        if (attempt >= DEFAULT_MAX_BATCH_RETRIES && pendingKeys.length > 0) {
          break;
        }
      }

      return allItems;
    });
  }

  batchWriteItems(puts?: DynamoItem[], deletes?: DynamoKey[]): Promise<void> {
    return this.executeWithErrorMapping("DynamoClientImpl.batchWriteItems", async () => {
      const writeRequests: WriteRequest[] = [
        ...(puts ?? []).map((item) => ({ PutRequest: { Item: this.toAttributeMap(item) } })),
        ...(deletes ?? []).map((key) => ({ DeleteRequest: { Key: this.toAttributeMap(key) } })),
      ];

      if (writeRequests.length === 0) {
        return;
      }

      let requestItems: Record<string, WriteRequest[]> | undefined = {
        [this.tableName]: writeRequests,
      };
      let attempt = 0;

      while (requestItems && Object.keys(requestItems).length > 0) {
        const output: BatchWriteItemCommandOutput = await this.sdk.send(new BatchWriteItemCommand({
          RequestItems: requestItems,
        }));

        requestItems = output.UnprocessedItems;

        attempt += 1;
        if (attempt >= DEFAULT_MAX_BATCH_RETRIES && requestItems && Object.keys(requestItems).length > 0) {
          break;
        }
      }
    });
  }

  query<T extends DynamoItem>(keyConditionExpression: string, options?: QueryOptions): Promise<QueryResult<T>> {
    return this.executeWithErrorMapping("DynamoClientImpl.query", async () => {
      const output = await this.sdk.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: keyConditionExpression,
        IndexName: options?.indexName,
        FilterExpression: options?.filterExpression,
        ProjectionExpression: options?.projectionExpression,
        ExpressionAttributeNames: options?.expressionAttributeNames,
        ExpressionAttributeValues: this.toExpressionAttributeValues(options?.expressionAttributeValues),
        ScanIndexForward: options?.scanIndexForward,
        Limit: options?.limit,
        ExclusiveStartKey: this.toOptionalAttributeMap(options?.exclusiveStartKey),
        ConsistentRead: options?.consistentRead,
        Select: options?.select,
      }));

      return {
        items: (output.Items ?? []).map((item) => this.fromAttributeMap<T>(item)),
        count: output.Count ?? 0,
        scannedCount: output.ScannedCount ?? 0,
        ...(output.LastEvaluatedKey && { lastEvaluatedKey: this.fromAttributeMap<DynamoKey>(output.LastEvaluatedKey) }),
      };
    });
  }

  scan<T extends DynamoItem>(options?: ScanOptions): Promise<QueryResult<T>> {
    return this.executeWithErrorMapping("DynamoClientImpl.scan", async () => {
      const output = await this.sdk.send(new ScanCommand({
        TableName: this.tableName,
        IndexName: options?.indexName,
        FilterExpression: options?.filterExpression,
        ProjectionExpression: options?.projectionExpression,
        ExpressionAttributeNames: options?.expressionAttributeNames,
        ExpressionAttributeValues: this.toExpressionAttributeValues(options?.expressionAttributeValues),
        Limit: options?.limit,
        ExclusiveStartKey: this.toOptionalAttributeMap(options?.exclusiveStartKey),
        Segment: options?.segment,
        TotalSegments: options?.totalSegments,
      }));

      return {
        items: (output.Items ?? []).map((item) => this.fromAttributeMap<T>(item)),
        count: output.Count ?? 0,
        scannedCount: output.ScannedCount ?? 0,
        ...(output.LastEvaluatedKey && { lastEvaluatedKey: this.fromAttributeMap<DynamoKey>(output.LastEvaluatedKey) }),
      };
    });
  }

  transactWrite(items: TransactWriteItem[]): Promise<void> {
    return this.executeWithErrorMapping("DynamoClientImpl.transactWrite", async () => {
      const transactItems: AwsTransactWriteItem[] = items.map((item) => this.mapTransactWriteItem(item));

      await this.sdk.send(new TransactWriteItemsCommand({
        TransactItems: transactItems,
      }));
    });
  }

  transactGet<T extends DynamoItem>(requests: Array<{ tableName: string; key: DynamoKey }>): Promise<(T | null)[]> {
    return this.executeWithErrorMapping("DynamoClientImpl.transactGet", async () => {
      if (requests.length === 0) {
        return [];
      }

      const transactItems: TransactGetItem[] = requests.map((request) => ({
        Get: {
          TableName: request.tableName,
          Key: this.toAttributeMap(request.key),
        },
      }));

      const output = await this.sdk.send(new TransactGetItemsCommand({
        TransactItems: transactItems,
      }));

      return (output.Responses ?? []).map((response) => {
        if (!response.Item) {
          return null;
        }

        return this.fromAttributeMap<T>(response.Item);
      });
    });
  }

  private mapTransactWriteItem(item: TransactWriteItem): AwsTransactWriteItem {
    switch (item.type) {
      case "Put":
        return {
          Put: {
            TableName: item.tableName,
            Item: this.toAttributeMap(item.item ?? {}),
            ConditionExpression: item.conditionExpression,
            ExpressionAttributeNames: item.expressionAttributeNames,
            ExpressionAttributeValues: this.toExpressionAttributeValues(item.expressionAttributeValues),
          },
        };
      case "Update":
        return {
          Update: {
            TableName: item.tableName,
            Key: this.toRequiredAttributeMap(item.key, "TransactWriteItem.Update.key"),
            UpdateExpression: item.updateExpression,
            ConditionExpression: item.conditionExpression,
            ExpressionAttributeNames: item.expressionAttributeNames,
            ExpressionAttributeValues: this.toExpressionAttributeValues(item.expressionAttributeValues),
          },
        };
      case "Delete":
        return {
          Delete: {
            TableName: item.tableName,
            Key: this.toRequiredAttributeMap(item.key, "TransactWriteItem.Delete.key"),
            ConditionExpression: item.conditionExpression,
            ExpressionAttributeNames: item.expressionAttributeNames,
            ExpressionAttributeValues: this.toExpressionAttributeValues(item.expressionAttributeValues),
          },
        };
      case "ConditionCheck":
        return {
          ConditionCheck: {
            TableName: item.tableName,
            Key: this.toRequiredAttributeMap(item.key, "TransactWriteItem.ConditionCheck.key"),
            ConditionExpression: item.conditionExpression,
            ExpressionAttributeNames: item.expressionAttributeNames,
            ExpressionAttributeValues: this.toExpressionAttributeValues(item.expressionAttributeValues),
          },
        };
      default:
        throw new AwsClientError("DynamoClientImpl.transactWrite: unsupported transaction item type", item);
    }
  }

  private toRequiredAttributeMap(item: DynamoItem | undefined, fieldName: string): Record<string, AttributeValue> {
    if (!item) {
      throw new AwsClientError(`DynamoClientImpl.transactWrite: missing required field ${fieldName}`);
    }

    return this.toAttributeMap(item);
  }

  private toOptionalAttributeMap(item: DynamoItem | undefined): Record<string, AttributeValue> | undefined {
    if (!item) {
      return undefined;
    }

    return this.toAttributeMap(item);
  }

  private toAttributeMap(item: DynamoItem): Record<string, AttributeValue> {
    return marshall(item, {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    });
  }

  private toExpressionAttributeValues(values: DynamoItem | undefined): Record<string, AttributeValue> | undefined {
    if (!values) {
      return undefined;
    }

    return marshall(values, {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    });
  }

  private fromAttributeMap<T extends DynamoItem>(item: Record<string, AttributeValue>): T {
    return unmarshall(item, {
      wrapNumbers: false,
    }) as T;
  }

  private async executeWithErrorMapping<T>(context: string, executor: () => Promise<T>): Promise<T> {
    try {
      return await executor();
    } catch (error) {
      throw toAwsClientError(error, `${context} failed`);
    }
  }
}
