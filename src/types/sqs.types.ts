import type { MessageAttributeValue } from "@aws-sdk/client-sqs";

export interface SendMessageOptions {
  delaySeconds?: number;
  messageAttributes?: Record<string, MessageAttributeValue>;
  messageGroupId?: string;
  messageDeduplicationId?: string;
}

export interface SQSMessage<T = unknown> {
  messageId: string;
  receiptHandle: string;
  body: T;
  attributes: Record<string, string>;
  messageAttributes?: Record<string, MessageAttributeValue>;
  sentTimestamp?: Date;
}

export interface ReceiveMessageOptions {
  maxNumberOfMessages?: number;
  visibilityTimeout?: number;
  waitTimeSeconds?: number;
  messageAttributeNames?: string[];
}

export interface SendMessageBatchEntry<T> {
  id: string;
  message: T;
  options?: SendMessageOptions;
}

export interface BatchResultEntry {
  id: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
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

export interface CreateQueueOptions {
  delaySeconds?: number;
  messageRetentionPeriod?: number;
  visibilityTimeout?: number;
  fifoQueue?: boolean;
  contentBasedDeduplication?: boolean;
  redrivePolicy?: {
    deadLetterTargetArn: string;
    maxReceiveCount: number;
  };
}
