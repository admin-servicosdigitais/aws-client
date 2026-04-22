import { describe, expect, it } from "vitest";
import { AwsClientError } from "../../../src/errors/aws-client.error.js";
import { toAwsClientError } from "../../../src/internal/utils/error.util.js";

describe("toAwsClientError", () => {
  it("returns the same instance when error is already AwsClientError", () => {
    const original = new AwsClientError("already mapped");

    const mapped = toAwsClientError(original, "fallback");

    expect(mapped).toBe(original);
  });

  it("wraps generic Error preserving message and cause", () => {
    const cause = new Error("boom");

    const mapped = toAwsClientError(cause, "failed to call aws");

    expect(mapped).toBeInstanceOf(AwsClientError);
    expect(mapped.message).toBe("failed to call aws: boom");
    expect(mapped.cause).toBe(cause);
  });

  it("wraps non-Error values with fallback message", () => {
    const mapped = toAwsClientError("unexpected", "failed to call aws");

    expect(mapped.message).toBe("failed to call aws");
    expect(mapped.cause).toBe("unexpected");
  });
});
