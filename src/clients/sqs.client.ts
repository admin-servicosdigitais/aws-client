import type { SQSClient as SQSSdkClient } from "@aws-sdk/client-sqs";
import type { ISQSClient } from "../interfaces/sqs.interface.js";
import type { QueueAttributes, SendMessageOptions } from "../types/sqs.types.js";
import { NotImplementedError } from "../errors/aws-client.error.js";

export class SQSClientImpl implements ISQSClient {
  constructor(
    private readonly sdk: SQSSdkClient,
    private readonly queueUrl: string,
  ) {}

  sendMessage<T>(_message: T, _options?: SendMessageOptions): Promise<string> {
    throw new NotImplementedError("SQSClientImpl.sendMessage");
  }

  purgeQueue(): Promise<void> {
    throw new NotImplementedError("SQSClientImpl.purgeQueue");
  }

  getQueueAttributes(): Promise<QueueAttributes> {
    throw new NotImplementedError("SQSClientImpl.getQueueAttributes");
  }
}
