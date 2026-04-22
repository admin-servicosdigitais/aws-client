import {
  GetQueueAttributesCommand,
  PurgeQueueCommand,
  SendMessageCommand,
  type SQSClient,
} from "@aws-sdk/client-sqs";
import { describe, expect, it, vi } from "vitest";
import { SQSClientImpl } from "../../src/clients/sqs.client.js";

function createSdkMock() {
  const send = vi.fn();
  const sdk = { send } as unknown as SQSClient;
  return { sdk, send };
}

describe("SQSClientImpl", () => {
  const queueUrl = "https://sqs.us-east-1.amazonaws.com/123456789012/minha-fila";

  it("sendMessage simple payload with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({ MessageId: "msg-123" });
    const client = new SQSClientImpl(sdk, queueUrl);

    const messageId = await client.sendMessage({ pedidoId: 42, status: "aprovado" });

    expect(messageId).toBe("msg-123");
    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(SendMessageCommand);
    expect((command as SendMessageCommand).input).toEqual({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ pedidoId: 42, status: "aprovado" }),
      DelaySeconds: undefined,
      MessageAttributes: undefined,
      MessageGroupId: undefined,
      MessageDeduplicationId: undefined,
    });
  });

  it("sendMessage with delay, attributes and fifo fields", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({ MessageId: "msg-fifo-456" });
    const client = new SQSClientImpl(sdk, queueUrl);

    const messageId = await client.sendMessage(
      { pedidoId: 42 },
      {
        delaySeconds: 15,
        messageAttributes: {
          tenantId: { DataType: "String", StringValue: "acme" },
          retryCount: { DataType: "Number", StringValue: "2" },
        },
        messageGroupId: "pedidos",
        messageDeduplicationId: "pedido-42-uniq",
      },
    );

    expect(messageId).toBe("msg-fifo-456");
    const command = send.mock.calls[0]?.[0] as SendMessageCommand;
    expect(command.input).toEqual({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ pedidoId: 42 }),
      DelaySeconds: 15,
      MessageAttributes: {
        tenantId: { DataType: "String", StringValue: "acme" },
        retryCount: { DataType: "Number", StringValue: "2" },
      },
      MessageGroupId: "pedidos",
      MessageDeduplicationId: "pedido-42-uniq",
    });
  });

  it("purgeQueue with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({});
    const client = new SQSClientImpl(sdk, queueUrl);

    await client.purgeQueue();

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PurgeQueueCommand);
    expect((command as PurgeQueueCommand).input).toEqual({ QueueUrl: queueUrl });
  });

  it("getQueueAttributes with correct parsing", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Attributes: {
        ApproximateNumberOfMessages: "12",
        ApproximateNumberOfMessagesNotVisible: "3",
        ApproximateNumberOfMessagesDelayed: "1",
        CreatedTimestamp: "1711710000",
        LastModifiedTimestamp: "1711710300",
        VisibilityTimeout: "30",
        MaximumMessageSize: "262144",
        MessageRetentionPeriod: "345600",
        DelaySeconds: "5",
        FifoQueue: "true",
      },
    });
    const client = new SQSClientImpl(sdk, queueUrl);

    const attributes = await client.getQueueAttributes();

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(GetQueueAttributesCommand);
    expect((command as GetQueueAttributesCommand).input).toEqual({
      QueueUrl: queueUrl,
      AttributeNames: [
        "ApproximateNumberOfMessages",
        "ApproximateNumberOfMessagesNotVisible",
        "ApproximateNumberOfMessagesDelayed",
        "CreatedTimestamp",
        "LastModifiedTimestamp",
        "VisibilityTimeout",
        "MaximumMessageSize",
        "MessageRetentionPeriod",
        "DelaySeconds",
        "FifoQueue",
      ],
    });

    expect(attributes).toEqual({
      approximateNumberOfMessages: 12,
      approximateNumberOfMessagesNotVisible: 3,
      approximateNumberOfMessagesDelayed: 1,
      createdTimestamp: new Date(1711710000 * 1000),
      lastModifiedTimestamp: new Date(1711710300 * 1000),
      visibilityTimeout: 30,
      maximumMessageSize: 262144,
      messageRetentionPeriod: 345600,
      delaySeconds: 5,
      fifoQueue: true,
    });
  });

  it("fails clearly when AWS response is inconsistent", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({ MessageId: undefined });
    const client = new SQSClientImpl(sdk, queueUrl);

    await expect(client.sendMessage({ hello: "world" })).rejects.toMatchObject({
      name: "AwsClientError",
      message: "SQSClientImpl.sendMessage: AWS SQS returned empty messageId",
    });
  });
});
