import type { QueueAttributes, SendMessageOptions } from "../types/sqs.types.js";

export interface ISQSClient {
  sendMessage<T>(message: T, options?: SendMessageOptions): Promise<string>;
  purgeQueue(): Promise<void>;
  getQueueAttributes(): Promise<QueueAttributes>;
}
