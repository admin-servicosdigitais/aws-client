import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  s3CtorMock,
  sqsCtorMock,
  dynamoCtorMock,
  bedrockAgentCtorMock,
  bedrockRuntimeCtorMock,
  stsCtorMock,
  defaultProviderMock,
  fromTemporaryCredentialsMock,
  s3ClientImplCtorMock,
  sqsClientImplCtorMock,
  dynamoClientImplCtorMock,
  bedrockClientImplCtorMock,
  opensearchClientImplCtorMock,
  stsClientImplCtorMock,
} = vi.hoisted(() => ({
  s3CtorMock: vi.fn(),
  sqsCtorMock: vi.fn(),
  dynamoCtorMock: vi.fn(),
  bedrockAgentCtorMock: vi.fn(),
  bedrockRuntimeCtorMock: vi.fn(),
  stsCtorMock: vi.fn(),
  defaultProviderMock: vi.fn(),
  fromTemporaryCredentialsMock: vi.fn(),
  s3ClientImplCtorMock: vi.fn(),
  sqsClientImplCtorMock: vi.fn(),
  dynamoClientImplCtorMock: vi.fn(),
  bedrockClientImplCtorMock: vi.fn(),
  opensearchClientImplCtorMock: vi.fn(),
  stsClientImplCtorMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({ S3Client: s3CtorMock }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: sqsCtorMock }));
vi.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: dynamoCtorMock }));
vi.mock("@aws-sdk/client-bedrock-agent", () => ({ BedrockAgentClient: bedrockAgentCtorMock }));
vi.mock("@aws-sdk/client-bedrock-agent-runtime", () => ({ BedrockAgentRuntimeClient: bedrockRuntimeCtorMock }));
vi.mock("@aws-sdk/client-sts", () => ({ STSClient: stsCtorMock }));
vi.mock("@aws-sdk/credential-provider-node", () => ({ defaultProvider: defaultProviderMock }));
vi.mock("@aws-sdk/credential-providers", () => ({ fromTemporaryCredentials: fromTemporaryCredentialsMock }));

vi.mock("../../src/clients/s3.client.js", () => ({ S3ClientImpl: s3ClientImplCtorMock }));
vi.mock("../../src/clients/sqs.client.js", () => ({ SQSClientImpl: sqsClientImplCtorMock }));
vi.mock("../../src/clients/dynamo.client.js", () => ({ DynamoClientImpl: dynamoClientImplCtorMock }));
vi.mock("../../src/clients/bedrock.client.js", () => ({ BedrockClientImpl: bedrockClientImplCtorMock }));
vi.mock("../../src/clients/opensearch-serverless.client.js", () => ({
  OpenSearchServerlessClientImpl: opensearchClientImplCtorMock,
}));
vi.mock("../../src/clients/sts.client.js", () => ({ StsClientImpl: stsClientImplCtorMock }));

import { AwsProvider } from "../../src/providers/aws.provider.js";

const ORIGINAL_ASSUME_ROLE = process.env.AWS_ASSUME_ROLE;

function instantiateAllClients(provider: AwsProvider) {
  provider.s3("bucket");
  provider.dynamo("table");
  provider.sqs("queue-url");
  provider.bedrock();
  provider.opensearchServerless("https://node");
  provider.sts();
}

describe("AwsProvider credential strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_ASSUME_ROLE = ORIGINAL_ASSUME_ROLE;
  });

  it("sem AWS_ASSUME_ROLE usa credencial base/origem", () => {
    delete process.env.AWS_ASSUME_ROLE;
    const baseCredentialsProvider = vi.fn();
    defaultProviderMock.mockReturnValue(baseCredentialsProvider);

    const provider = new AwsProvider({ region: "us-east-1" });
    instantiateAllClients(provider);

    expect(defaultProviderMock).toHaveBeenCalledTimes(1);
    expect(fromTemporaryCredentialsMock).not.toHaveBeenCalled();

    const sdkCredentials = s3CtorMock.mock.calls[0]?.[0]?.credentials;
    expect(sdkCredentials).toBe(baseCredentialsProvider);
    expect(sqsCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(dynamoCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(bedrockAgentCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(bedrockRuntimeCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(stsCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(opensearchClientImplCtorMock.mock.calls[0]?.[2]).toBe(sdkCredentials);
  });

  it("com AWS_ASSUME_ROLE válido usa provider temporário com assume role", () => {
    process.env.AWS_ASSUME_ROLE = "arn:aws:iam::123456789012:role/demo-role";

    const baseCredentialsProvider = vi.fn();
    const temporaryCredentialsProvider = vi.fn();
    defaultProviderMock.mockReturnValue(baseCredentialsProvider);
    fromTemporaryCredentialsMock.mockReturnValue(temporaryCredentialsProvider);

    const provider = new AwsProvider({ region: "us-east-1" });
    instantiateAllClients(provider);

    expect(defaultProviderMock).toHaveBeenCalledTimes(1);
    expect(fromTemporaryCredentialsMock).toHaveBeenCalledTimes(1);
    expect(fromTemporaryCredentialsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        masterCredentials: baseCredentialsProvider,
        params: expect.objectContaining({ RoleArn: process.env.AWS_ASSUME_ROLE }),
      }),
    );

    const sdkCredentials = s3CtorMock.mock.calls[0]?.[0]?.credentials;
    expect(sdkCredentials).toBe(temporaryCredentialsProvider);
    expect(sqsCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(dynamoCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(bedrockAgentCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(bedrockRuntimeCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(stsCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(opensearchClientImplCtorMock.mock.calls[0]?.[2]).toBe(sdkCredentials);
  });

  it("com AWS_ASSUME_ROLE inválido lança erro explícito", () => {
    process.env.AWS_ASSUME_ROLE = "invalid-role";
    defaultProviderMock.mockReturnValue(vi.fn());

    const provider = new AwsProvider({ region: "us-east-1" });

    expect(() => provider.s3("bucket")).toThrow("Invalid AWS_ASSUME_ROLE value: invalid-role");
    expect(fromTemporaryCredentialsMock).not.toHaveBeenCalled();
  });

  it("mantém compatibilidade com credentials explícita", () => {
    process.env.AWS_ASSUME_ROLE = "arn:aws:iam::123456789012:role/demo-role";
    const explicitCredentials = {
      accessKeyId: "AKIA123",
      secretAccessKey: "secret",
      sessionToken: "token",
    };

    const provider = new AwsProvider({ region: "us-east-1", credentials: explicitCredentials });
    instantiateAllClients(provider);

    expect(defaultProviderMock).not.toHaveBeenCalled();
    expect(fromTemporaryCredentialsMock).not.toHaveBeenCalled();

    const sdkCredentials = s3CtorMock.mock.calls[0]?.[0]?.credentials;
    expect(sdkCredentials).toBe(explicitCredentials);
    expect(sqsCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(dynamoCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(bedrockAgentCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(bedrockRuntimeCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(stsCtorMock.mock.calls[0]?.[0]?.credentials).toBe(sdkCredentials);
    expect(opensearchClientImplCtorMock.mock.calls[0]?.[2]).toBe(sdkCredentials);
  });
});
