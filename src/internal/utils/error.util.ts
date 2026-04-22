import { AwsClientError } from "../../errors/aws-client.error.js";

export function toAwsClientError(error: unknown, message: string): AwsClientError {
  if (error instanceof AwsClientError) {
    return error;
  }

  const normalizedMessage = error instanceof Error && error.message.length > 0
    ? `${message}: ${error.message}`
    : message;

  return new AwsClientError(normalizedMessage, error);
}
