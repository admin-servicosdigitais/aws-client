import {
  BatchGetItemCommand,
  BatchWriteItemCommand,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  TransactGetItemsCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
  type DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { DynamoClientImpl } from "../../src/clients/dynamo.client.js";

function createSdkMock() {
  const send = vi.fn();
  const sdk = { send } as unknown as DynamoDBClient;
  return { sdk, send };
}

describe("DynamoClientImpl", () => {
  const tableName = "Pedidos";

  it("putItem with and without conditionExpression", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({});
    const client = new DynamoClientImpl(sdk, tableName);

    await client.putItem({ pk: "P#1", sk: "META", amount: 100 });
    await client.putItem(
      { pk: "P#2", sk: "META", amount: 200 },
      {
        conditionExpression: "attribute_not_exists(#pk)",
        expressionAttributeNames: { "#pk": "pk" },
      },
    );

    expect(send).toHaveBeenCalledTimes(2);

    const first = send.mock.calls[0]?.[0] as PutItemCommand;
    expect(first).toBeInstanceOf(PutItemCommand);
    expect(first.input).toMatchObject({
      TableName: tableName,
      Item: marshall({ pk: "P#1", sk: "META", amount: 100 }),
      ConditionExpression: undefined,
    });

    const second = send.mock.calls[1]?.[0] as PutItemCommand;
    expect(second.input).toMatchObject({
      TableName: tableName,
      Item: marshall({ pk: "P#2", sk: "META", amount: 200 }),
      ConditionExpression: "attribute_not_exists(#pk)",
      ExpressionAttributeNames: { "#pk": "pk" },
    });
  });

  it("getItem found and not found", async () => {
    const { sdk, send } = createSdkMock();
    send
      .mockResolvedValueOnce({ Item: marshall({ pk: "P#1", sk: "META", amount: 100 }) })
      .mockResolvedValueOnce({ Item: undefined });
    const client = new DynamoClientImpl(sdk, tableName);

    const found = await client.getItem<{ pk: string; sk: string; amount: number }>({ pk: "P#1", sk: "META" });
    const notFound = await client.getItem({ pk: "P#2", sk: "META" });

    expect(found).toEqual({ pk: "P#1", sk: "META", amount: 100 });
    expect(notFound).toBeNull();

    const command = send.mock.calls[0]?.[0] as GetItemCommand;
    expect(command).toBeInstanceOf(GetItemCommand);
    expect(command.input).toMatchObject({
      TableName: tableName,
      Key: marshall({ pk: "P#1", sk: "META" }),
    });
  });

  it("updateItem returns updated attributes when available", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Attributes: marshall({ pk: "P#1", sk: "META", status: "UPDATED" }),
    });
    const client = new DynamoClientImpl(sdk, tableName);

    const output = await client.updateItem(
      { pk: "P#1", sk: "META" },
      "SET #status = :status",
      {
        expressionAttributeNames: { "#status": "status" },
        expressionAttributeValues: { ":status": "UPDATED" },
        returnValues: "ALL_NEW",
      },
    );

    expect(output).toEqual({ pk: "P#1", sk: "META", status: "UPDATED" });
    const command = send.mock.calls[0]?.[0] as UpdateItemCommand;
    expect(command).toBeInstanceOf(UpdateItemCommand);
    expect(command.input).toMatchObject({
      TableName: tableName,
      Key: marshall({ pk: "P#1", sk: "META" }),
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: marshall({ ":status": "UPDATED" }),
      ReturnValues: "ALL_NEW",
    });
  });

  it("deleteItem sends expected command", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({});
    const client = new DynamoClientImpl(sdk, tableName);

    await client.deleteItem(
      { pk: "P#1", sk: "META" },
      {
        conditionExpression: "attribute_exists(#pk)",
        expressionAttributeNames: { "#pk": "pk" },
      },
    );

    const command = send.mock.calls[0]?.[0] as DeleteItemCommand;
    expect(command).toBeInstanceOf(DeleteItemCommand);
    expect(command.input).toMatchObject({
      TableName: tableName,
      Key: marshall({ pk: "P#1", sk: "META" }),
      ConditionExpression: "attribute_exists(#pk)",
      ExpressionAttributeNames: { "#pk": "pk" },
    });
  });

  it("batchGetItems maps items", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Responses: {
        [tableName]: [
          marshall({ pk: "P#1", sk: "META" }),
          marshall({ pk: "P#2", sk: "META" }),
        ],
      },
    });
    const client = new DynamoClientImpl(sdk, tableName);

    const items = await client.batchGetItems([{ pk: "P#1", sk: "META" }, { pk: "P#2", sk: "META" }]);

    expect(items).toEqual([
      { pk: "P#1", sk: "META" },
      { pk: "P#2", sk: "META" },
    ]);
    const command = send.mock.calls[0]?.[0] as BatchGetItemCommand;
    expect(command).toBeInstanceOf(BatchGetItemCommand);
    expect(command.input.RequestItems?.[tableName]?.Keys).toEqual([
      marshall({ pk: "P#1", sk: "META" }),
      marshall({ pk: "P#2", sk: "META" }),
    ]);
  });

  it("batchWriteItems with put and delete", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({ UnprocessedItems: {} });
    const client = new DynamoClientImpl(sdk, tableName);

    await client.batchWriteItems(
      [{ pk: "P#1", sk: "META", status: "NEW" }],
      [{ pk: "P#2", sk: "META" }],
    );

    const command = send.mock.calls[0]?.[0] as BatchWriteItemCommand;
    expect(command).toBeInstanceOf(BatchWriteItemCommand);
    expect(command.input.RequestItems?.[tableName]).toEqual([
      { PutRequest: { Item: marshall({ pk: "P#1", sk: "META", status: "NEW" }) } },
      { DeleteRequest: { Key: marshall({ pk: "P#2", sk: "META" }) } },
    ]);
  });

  it("query supports index/filter/pagination", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Items: [marshall({ pk: "TENANT#1", sk: "P#1", status: "OPEN" })],
      Count: 1,
      ScannedCount: 5,
      LastEvaluatedKey: marshall({ pk: "TENANT#1", sk: "P#1" }),
    });
    const client = new DynamoClientImpl(sdk, tableName);

    const output = await client.query<{ pk: string; sk: string; status: string }>(
      "#pk = :pk",
      {
        indexName: "gsi1",
        filterExpression: "#status = :status",
        expressionAttributeNames: { "#pk": "pk", "#status": "status" },
        expressionAttributeValues: { ":pk": "TENANT#1", ":status": "OPEN" },
        exclusiveStartKey: { pk: "TENANT#1", sk: "P#0" },
        limit: 10,
        scanIndexForward: false,
      },
    );

    expect(output).toEqual({
      items: [{ pk: "TENANT#1", sk: "P#1", status: "OPEN" }],
      count: 1,
      scannedCount: 5,
      lastEvaluatedKey: { pk: "TENANT#1", sk: "P#1" },
    });

    const command = send.mock.calls[0]?.[0] as QueryCommand;
    expect(command).toBeInstanceOf(QueryCommand);
    expect(command.input).toMatchObject({
      TableName: tableName,
      KeyConditionExpression: "#pk = :pk",
      IndexName: "gsi1",
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: { "#pk": "pk", "#status": "status" },
      ExpressionAttributeValues: marshall({ ":pk": "TENANT#1", ":status": "OPEN" }),
      ExclusiveStartKey: marshall({ pk: "TENANT#1", sk: "P#0" }),
      Limit: 10,
      ScanIndexForward: false,
    });
  });

  it("scan supports limit and exclusiveStartKey", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Items: [marshall({ pk: "P#1", sk: "META" })],
      Count: 1,
      ScannedCount: 1,
    });
    const client = new DynamoClientImpl(sdk, tableName);

    const output = await client.scan({ limit: 1, exclusiveStartKey: { pk: "P#0", sk: "META" } });

    expect(output).toEqual({
      items: [{ pk: "P#1", sk: "META" }],
      count: 1,
      scannedCount: 1,
    });

    const command = send.mock.calls[0]?.[0] as ScanCommand;
    expect(command).toBeInstanceOf(ScanCommand);
    expect(command.input).toMatchObject({
      TableName: tableName,
      Limit: 1,
      ExclusiveStartKey: marshall({ pk: "P#0", sk: "META" }),
    });
  });

  it("transactWrite with multiple item types", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({});
    const client = new DynamoClientImpl(sdk, tableName);

    await client.transactWrite([
      {
        type: "Put",
        tableName,
        item: { pk: "P#1", sk: "META", status: "NEW" },
      },
      {
        type: "Update",
        tableName,
        key: { pk: "P#1", sk: "META" },
        updateExpression: "SET #status = :status",
        expressionAttributeNames: { "#status": "status" },
        expressionAttributeValues: { ":status": "DONE" },
      },
      {
        type: "Delete",
        tableName,
        key: { pk: "P#2", sk: "META" },
      },
      {
        type: "ConditionCheck",
        tableName,
        key: { pk: "P#3", sk: "META" },
        conditionExpression: "attribute_exists(pk)",
      },
    ]);

    const command = send.mock.calls[0]?.[0] as TransactWriteItemsCommand;
    expect(command).toBeInstanceOf(TransactWriteItemsCommand);
    expect(command.input.TransactItems).toEqual([
      {
        Put: {
          TableName: tableName,
          Item: marshall({ pk: "P#1", sk: "META", status: "NEW" }),
          ConditionExpression: undefined,
          ExpressionAttributeNames: undefined,
          ExpressionAttributeValues: undefined,
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: marshall({ pk: "P#1", sk: "META" }),
          UpdateExpression: "SET #status = :status",
          ConditionExpression: undefined,
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: marshall({ ":status": "DONE" }),
        },
      },
      {
        Delete: {
          TableName: tableName,
          Key: marshall({ pk: "P#2", sk: "META" }),
          ConditionExpression: undefined,
          ExpressionAttributeNames: undefined,
          ExpressionAttributeValues: undefined,
        },
      },
      {
        ConditionCheck: {
          TableName: tableName,
          Key: marshall({ pk: "P#3", sk: "META" }),
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeNames: undefined,
          ExpressionAttributeValues: undefined,
        },
      },
    ]);
  });

  it("transactGet maps found and missing items", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Responses: [
        { Item: marshall({ pk: "P#1", sk: "META", status: "NEW" }) },
        { Item: undefined },
      ],
    });
    const client = new DynamoClientImpl(sdk, tableName);

    const output = await client.transactGet([
      { tableName, key: { pk: "P#1", sk: "META" } },
      { tableName, key: { pk: "P#2", sk: "META" } },
    ]);

    expect(output).toEqual([
      { pk: "P#1", sk: "META", status: "NEW" },
      null,
    ]);

    const command = send.mock.calls[0]?.[0] as TransactGetItemsCommand;
    expect(command).toBeInstanceOf(TransactGetItemsCommand);
    expect(command.input.TransactItems).toEqual([
      {
        Get: {
          TableName: tableName,
          Key: marshall({ pk: "P#1", sk: "META" }),
        },
      },
      {
        Get: {
          TableName: tableName,
          Key: marshall({ pk: "P#2", sk: "META" }),
        },
      },
    ]);
  });

  it("maps sdk errors to AwsClientError", async () => {
    const { sdk, send } = createSdkMock();
    send.mockRejectedValue(new Error("dynamo denied"));
    const client = new DynamoClientImpl(sdk, tableName);

    await expect(client.putItem({ pk: "P#1", sk: "META" })).rejects.toMatchObject({
      name: "AwsClientError",
      message: "DynamoClientImpl.putItem failed: dynamo denied",
    });
  });
});
