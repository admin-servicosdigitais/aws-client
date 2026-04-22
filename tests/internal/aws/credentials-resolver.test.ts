import { beforeEach, describe, expect, it, vi } from "vitest";

const { defaultProviderMock, sendMock } = vi.hoisted(() => ({
  defaultProviderMock: vi.fn(),
  sendMock: vi.fn(),
}));

vi.mock("@aws-sdk/credential-provider-node", () => ({
  defaultProvider: defaultProviderMock,
}));

vi.mock("@aws-sdk/client-sts", () => ({
  AssumeRoleCommand: class {
    constructor(public readonly input: Record<string, string>) {}
  },
  STSClient: class {
    send = sendMock;
    constructor(public readonly config: Record<string, unknown>) {}
  },
}));

import { resolveCredentials } from "../../../src/internal/aws/credentials-resolver.js";

describe("resolveCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AWS_ASSUME_ROLE;
  });

  it("returns explicit credentials when AWS_ASSUME_ROLE is not set", () => {
    const credentials = {
      accessKeyId: "AKIA123",
      secretAccessKey: "SECRET123",
    };

    const resolved = resolveCredentials({
      region: "us-east-1",
      credentials,
    });

    expect(resolved).toBe(credentials);
  });

  it("throws a clear error for invalid AWS_ASSUME_ROLE values", () => {
    process.env.AWS_ASSUME_ROLE = "invalid-role-arn";

    expect(() => resolveCredentials({ region: "us-east-1" })).toThrow(
      /Invalid AWS_ASSUME_ROLE value: "invalid-role-arn"/,
    );
  });

  it("returns an assume-role provider when AWS_ASSUME_ROLE is valid", async () => {
    process.env.AWS_ASSUME_ROLE = "arn:aws:iam::123456789012:role/MyRole";
    sendMock.mockResolvedValueOnce({
      Credentials: {
        AccessKeyId: "ASSUMED_KEY",
        SecretAccessKey: "ASSUMED_SECRET",
        SessionToken: "ASSUMED_TOKEN",
        Expiration: new Date(Date.now() + 10 * 60_000),
      },
    });

    const resolved = resolveCredentials({
      region: "us-east-1",
      credentials: {
        accessKeyId: "SOURCE_KEY",
        secretAccessKey: "SOURCE_SECRET",
      },
    });

    expect(typeof resolved).toBe("function");

    const credentials = await resolved!();

    expect(credentials).toEqual({
      accessKeyId: "ASSUMED_KEY",
      secretAccessKey: "ASSUMED_SECRET",
      sessionToken: "ASSUMED_TOKEN",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
