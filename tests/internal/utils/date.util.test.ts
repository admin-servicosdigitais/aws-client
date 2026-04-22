import { describe, expect, it } from "vitest";
import { AwsClientError } from "../../../src/errors/aws-client.error.js";
import { parseAwsDate, parseRequiredAwsDate } from "../../../src/internal/utils/date.util.js";

describe("parseAwsDate", () => {
  it("parses unix timestamps in seconds", () => {
    const parsed = parseAwsDate(1_700_000_000);

    expect(parsed?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it("parses unix timestamps in milliseconds", () => {
    const parsed = parseAwsDate(1_700_000_000_000);

    expect(parsed?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it("parses numeric strings and ISO strings", () => {
    expect(parseAwsDate("1700000000")?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(parseAwsDate("2024-01-01T00:00:00.000Z")?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });

  it("returns undefined for empty or invalid values", () => {
    expect(parseAwsDate(undefined)).toBeUndefined();
    expect(parseAwsDate(null)).toBeUndefined();
    expect(parseAwsDate("   ")).toBeUndefined();
    expect(parseAwsDate("invalid-date")).toBeUndefined();
    expect(parseAwsDate(Number.NaN)).toBeUndefined();
  });
});

describe("parseRequiredAwsDate", () => {
  it("throws AwsClientError for invalid values", () => {
    expect(() => parseRequiredAwsDate("invalid", "createdAt")).toThrow(AwsClientError);
    expect(() => parseRequiredAwsDate("invalid", "createdAt")).toThrow(
      'Invalid AWS date for field "createdAt"',
    );
  });
});
