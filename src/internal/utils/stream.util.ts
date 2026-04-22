import { Readable } from "node:stream";
import { AwsClientError } from "../../errors/aws-client.error.js";

export async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  if (body instanceof Readable) {
    return consumeNodeStream(body);
  }

  if (isWebReadableStream(body)) {
    return consumeWebStream(body);
  }

  throw new AwsClientError("Unsupported stream payload type");
}

async function consumeNodeStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }

    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    throw new AwsClientError("Node stream emitted an unsupported chunk type");
  }

  return Buffer.concat(chunks);
}

async function consumeWebStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value !== undefined) {
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function isWebReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return (
    typeof value === "object" &&
    value !== null &&
    "getReader" in value &&
    typeof (value as { getReader?: unknown }).getReader === "function"
  );
}
