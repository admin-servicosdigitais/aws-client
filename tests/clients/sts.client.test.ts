import {
  AssumeRoleCommand,
  AssumeRoleWithWebIdentityCommand,
  GetCallerIdentityCommand,
  type STSClient,
} from "@aws-sdk/client-sts";
import { describe, expect, it, vi } from "vitest";
import { StsClientImpl } from "../../src/clients/sts.client.js";
import { AwsClientError } from "../../src/errors/aws-client.error.js";

function createSdkMock() {
  const send = vi.fn();
  const sdk = { send } as unknown as STSClient;
  return { sdk, send };
}

describe("StsClientImpl", () => {
  it("assumeRole with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Credentials: {
        AccessKeyId: "AKIA123",
        SecretAccessKey: "secret",
        SessionToken: "token",
      },
    });
    const client = new StsClientImpl(sdk);

    const result = await client.assumeRole("arn:aws:iam::123456789012:role/demo", "session-demo", {
      durationSeconds: 900,
      externalId: "ext-123",
      policy: '{"Version":"2012-10-17"}',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(AssumeRoleCommand);
    expect((command as AssumeRoleCommand).input).toEqual({
      RoleArn: "arn:aws:iam::123456789012:role/demo",
      RoleSessionName: "session-demo",
      DurationSeconds: 900,
      ExternalId: "ext-123",
      Policy: '{"Version":"2012-10-17"}',
    });
    expect(result).toEqual({
      accessKeyId: "AKIA123",
      secretAccessKey: "secret",
      sessionToken: "token",
    });
  });

  it("assumeRoleWithWebIdentity with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Credentials: {
        AccessKeyId: "AKIA456",
        SecretAccessKey: "secret-web",
      },
    });
    const client = new StsClientImpl(sdk);

    const result = await client.assumeRoleWithWebIdentity(
      "arn:aws:iam::123456789012:role/web",
      "web-session",
      "jwt-token",
      { durationSeconds: 3600, policy: '{"Statement":[]}' },
    );

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(AssumeRoleWithWebIdentityCommand);
    expect((command as AssumeRoleWithWebIdentityCommand).input).toEqual({
      RoleArn: "arn:aws:iam::123456789012:role/web",
      RoleSessionName: "web-session",
      WebIdentityToken: "jwt-token",
      DurationSeconds: 3600,
      Policy: '{"Statement":[]}',
    });
    expect(result).toEqual({
      accessKeyId: "AKIA456",
      secretAccessKey: "secret-web",
    });
  });

  it("getCallerIdentity with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Account: "123456789012",
      Arn: "arn:aws:sts::123456789012:assumed-role/demo/session",
      UserId: "AIDAXXX:session",
    });
    const client = new StsClientImpl(sdk);

    const result = await client.getCallerIdentity();

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(GetCallerIdentityCommand);
    expect((command as GetCallerIdentityCommand).input).toEqual({});
    expect(result).toEqual({
      accountId: "123456789012",
      arn: "arn:aws:sts::123456789012:assumed-role/demo/session",
      userId: "AIDAXXX:session",
    });
  });

  it("fails when AWS returns missing or incomplete credentials", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Credentials: {
        AccessKeyId: "AKIA789",
      },
    });
    const client = new StsClientImpl(sdk);

    await expect(
      client.assumeRole("arn:aws:iam::123456789012:role/demo", "missing-secret"),
    ).rejects.toMatchObject({
      name: "AwsClientError",
      message: "StsClientImpl.assumeRole: AWS STS returned incomplete credentials",
      cause: { AccessKeyId: "AKIA789" },
    });
  });

  it("maps aws sdk errors to AwsClientError", async () => {
    const { sdk, send } = createSdkMock();
    send.mockRejectedValue(new Error("sts denied"));
    const client = new StsClientImpl(sdk);

    await expect(client.getCallerIdentity()).rejects.toMatchObject({
      name: "AwsClientError",
      message: "StsClientImpl.getCallerIdentity failed: sts denied",
      cause: expect.any(Error),
    });
  });
});
