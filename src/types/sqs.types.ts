import type { MessageAttributeValue } from "@aws-sdk/client-sqs";

export interface SendMessageOptions {
  delaySeconds?: number;
  messageAttributes?: Record<string, MessageAttributeValue>;
  messageGroupId?: string;
  messageDeduplicationId?: string;
}

export interface QueueAttributes {
  approximateNumberOfMessages: number;
  approximateNumberOfMessagesNotVisible: number;
  approximateNumberOfMessagesDelayed: number;
  createdTimestamp: Date;
  lastModifiedTimestamp: Date;
  visibilityTimeout: number;
  maximumMessageSize: number;
  messageRetentionPeriod: number;
  delaySeconds: number;
  fifoQueue: boolean;
}
