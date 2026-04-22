import {
  GetQueueAttributesCommand,
  PurgeQueueCommand,
  SendMessageCommand,
  type SQSClient as SQSSdkClient,
} from "@aws-sdk/client-sqs";
import type { ISQSClient } from "../interfaces/sqs.interface.js";
import type { QueueAttributes, SendMessageOptions } from "../types/sqs.types.js";
import { AwsClientError } from "../errors/aws-client.error.js";
import { parseRequiredAwsDate } from "../internal/utils/date.util.js";
import { toAwsClientError } from "../internal/utils/error.util.js";

const QUEUE_ATTRIBUTE_NAMES = [
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
] as const;

export class SQSClientImpl implements ISQSClient {
  constructor(
    private readonly sdk: SQSSdkClient,
    private readonly queueUrl: string,
  ) {}

  sendMessage<T>(message: T, options?: SendMessageOptions): Promise<string> {
    return this.executeWithErrorMapping("SQSClientImpl.sendMessage", async () => {
      const output = await this.sdk.send(new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        DelaySeconds: options?.delaySeconds,
        MessageAttributes: options?.messageAttributes,
        MessageGroupId: options?.messageGroupId,
        MessageDeduplicationId: options?.messageDeduplicationId,
      }));

      if (!output.MessageId) {
        throw new AwsClientError("SQSClientImpl.sendMessage: AWS SQS returned empty messageId", output);
      }

      return output.MessageId;
    });
  }

  purgeQueue(): Promise<void> {
    return this.executeWithErrorMapping("SQSClientImpl.purgeQueue", async () => {
      await this.sdk.send(new PurgeQueueCommand({
        QueueUrl: this.queueUrl,
      }));
    });
  }

  getQueueAttributes(): Promise<QueueAttributes> {
    return this.executeWithErrorMapping("SQSClientImpl.getQueueAttributes", async () => {
      const output = await this.sdk.send(new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: [...QUEUE_ATTRIBUTE_NAMES],
      }));

      return this.mapQueueAttributes(output.Attributes);
    });
  }

  private mapQueueAttributes(attributes: Record<string, string> | undefined): QueueAttributes {
    if (!attributes) {
      throw new AwsClientError("SQSClientImpl.getQueueAttributes: AWS SQS returned empty attributes");
    }

    return {
      approximateNumberOfMessages: this.parseRequiredNumber(attributes, "ApproximateNumberOfMessages"),
      approximateNumberOfMessagesNotVisible: this.parseRequiredNumber(attributes, "ApproximateNumberOfMessagesNotVisible"),
      approximateNumberOfMessagesDelayed: this.parseRequiredNumber(attributes, "ApproximateNumberOfMessagesDelayed"),
      createdTimestamp: parseRequiredAwsDate(attributes.CreatedTimestamp, "CreatedTimestamp"),
      lastModifiedTimestamp: parseRequiredAwsDate(attributes.LastModifiedTimestamp, "LastModifiedTimestamp"),
      visibilityTimeout: this.parseRequiredNumber(attributes, "VisibilityTimeout"),
      maximumMessageSize: this.parseRequiredNumber(attributes, "MaximumMessageSize"),
      messageRetentionPeriod: this.parseRequiredNumber(attributes, "MessageRetentionPeriod"),
      delaySeconds: this.parseRequiredNumber(attributes, "DelaySeconds"),
      fifoQueue: this.parseRequiredBoolean(attributes, "FifoQueue"),
    };
  }

  private parseRequiredNumber(attributes: Record<string, string>, name: string): number {
    const rawValue = attributes[name];
    const parsed = Number(rawValue);

    if (rawValue === undefined || !Number.isFinite(parsed)) {
      throw new AwsClientError(`SQSClientImpl.getQueueAttributes: invalid attribute \"${name}\"`, {
        [name]: rawValue,
      });
    }

    return parsed;
  }

  private parseRequiredBoolean(attributes: Record<string, string>, name: string): boolean {
    const rawValue = attributes[name];

    if (rawValue === "true") {
      return true;
    }

    if (rawValue === "false") {
      return false;
    }

    throw new AwsClientError(`SQSClientImpl.getQueueAttributes: invalid attribute \"${name}\"`, {
      [name]: rawValue,
    });
  }

  private async executeWithErrorMapping<T>(context: string, executor: () => Promise<T>): Promise<T> {
    try {
      return await executor();
    } catch (error) {
      throw toAwsClientError(error, `${context} failed`);
    }
  }
}
