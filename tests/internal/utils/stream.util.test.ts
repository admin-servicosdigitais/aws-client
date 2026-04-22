import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { AwsClientError } from "../../../src/errors/aws-client.error.js";
import { streamToBuffer } from "../../../src/internal/utils/stream.util.js";

describe("streamToBuffer", () => {
  it("returns the same buffer when body is Buffer", async () => {
    const body = Buffer.from("hello");

    const output = await streamToBuffer(body);

    expect(output).toBe(body);
  });

  it("converts Uint8Array and string into Buffer", async () => {
    expect((await streamToBuffer(new Uint8Array([65, 66]))).toString("utf8")).toBe("AB");
    expect((await streamToBuffer("abc")).toString("utf8")).toBe("abc");
  });

  it("reads Node.js readable streams", async () => {
    const stream = Readable.from([Buffer.from("ab"), "cd", new Uint8Array([101, 102])]);

    const output = await streamToBuffer(stream);

    expect(output.toString("utf8")).toBe("abcdef");
  });

  it("reads Web ReadableStream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([65, 66]));
        controller.enqueue(new Uint8Array([67]));
        controller.close();
      },
    });

    const output = await streamToBuffer(stream);

    expect(output.toString("utf8")).toBe("ABC");
  });

  it("throws AwsClientError for unsupported values", async () => {
    await expect(streamToBuffer(123)).rejects.toBeInstanceOf(AwsClientError);
  });
});
