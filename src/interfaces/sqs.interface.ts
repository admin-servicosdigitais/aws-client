import type {
  BatchResultEntry,
  CreateQueueOptions,
  QueueAttributes,
  ReceiveMessageOptions,
  SendMessageBatchEntry,
  SendMessageOptions,
  SQSMessage,
} from "../types/sqs.types.js";

export interface ISQSClient {
  sendMessage<T>(message: T, options?: SendMessageOptions): Promise<string>;
  sendMessageBatch<T>(entries: SendMessageBatchEntry<T>[]): Promise<BatchResultEntry[]>;

  receiveMessages<T>(options?: ReceiveMessageOptions): Promise<SQSMessage<T>[]>;

  deleteMessage(receiptHandle: string): Promise<void>;
  deleteMessageBatch(receiptHandles: string[]): Promise<BatchResultEntry[]>;

  changeMessageVisibility(receiptHandle: string, visibilityTimeout: number): Promise<void>;
  changeMessageVisibilityBatch(
    entries: Array<{ receiptHandle: string; visibilityTimeout: number }>
  ): Promise<BatchResultEntry[]>;

  createQueue(queueName: string, options?: CreateQueueOptions): Promise<string>;
  deleteQueue(): Promise<void>;
  purgeQueue(): Promise<void>;
  getQueueAttributes(): Promise<QueueAttributes>;
}
