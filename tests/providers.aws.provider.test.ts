import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  s3CtorMock,
  sqsCtorMock,
  dynamoCtorMock,
  bedrockAgentCtorMock,
  bedrockRuntimeCtorMock,
  stsCtorMock,
  stsSendMock,
  defaultProviderMock,
  openSearchClientImplCtorMock,
} = vi.hoisted(() => ({
  s3CtorMock: vi.fn(),
  sqsCtorMock: vi.fn(),
  dynamoCtorMock: vi.fn(),
  bedrockAgentCtorMock: vi.fn(),
  bedrockRuntimeCtorMock: vi.fn(),
  stsCtorMock: vi.fn(),
  stsSendMock: vi.fn(),
  defaultProviderMock: vi.fn(),
  openSearchClientImplCtorMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => ({ S3Client: s3CtorMock }));
vi.mock("@aws-sdk/client-sqs", () => ({ SQSClient: sqsCtorMock }));
vi.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: dynamoCtorMock }));
vi.mock("@aws-sdk/client-bedrock-agent", () => ({ BedrockAgentClient: bedrockAgentCtorMock }));
vi.mock("@aws-sdk/client-bedrock-agent-runtime", () => ({ BedrockAgentRuntimeClient: bedrockRuntimeCtorMock }));
vi.mock("@aws-sdk/credential-provider-node", () => ({ defaultProvider: defaultProviderMock }));
vi.mock("@aws-sdk/client-sts", () => ({
  STSClient: stsCtorMock,
  AssumeRoleCommand: class AssumeRoleCommand {
    constructor(public readonly input: unknown) {}
  },
}));
vi.mock("../src/clients/opensearch-serverless.client.js", () => ({
  OpenSearchServerlessClientImpl: openSearchClientImplCtorMock,
}));

import { AwsProvider } from "../src/providers/aws.provider.js";

describe("AwsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AWS_ASSUME_ROLE;

    const baseProviderFn = vi.fn().mockResolvedValue({
      accessKeyId: "BASE",
      secretAccessKey: "BASE_SECRET",
    });

    defaultProviderMock.mockReturnValue(baseProviderFn);
    stsCtorMock.mockImplementation(() => ({ send: stsSendMock }));
    stsSendMock.mockResolvedValue({
      Credentials: {
        AccessKeyId: "ASSUMED",
        SecretAccessKey: "ASSUMED_SECRET",
        SessionToken: "ASSUMED_TOKEN",
        Expiration: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  });

  it("envia credenciais resolvidas para o cliente OpenSearch", async () => {
    process.env.AWS_ASSUME_ROLE = "arn:aws:iam::999888777666:role/CrossAccountRole";

    const provider = new AwsProvider({ region: "us-east-1" });
    provider.opensearchServerless("https://collection.us-east-1.aoss.amazonaws.com");

    const credentialsProvider = openSearchClientImplCtorMock.mock.calls[0]?.[2] as () => Promise<unknown>;

    await expect(credentialsProvider()).resolves.toMatchObject({
      accessKeyId: "ASSUMED",
      secretAccessKey: "ASSUMED_SECRET",
      sessionToken: "ASSUMED_TOKEN",
    });

    expect(stsCtorMock).toHaveBeenCalledTimes(1);
  });

  it("reutiliza credenciais resolvidas para os SDK clients", async () => {
    process.env.AWS_ASSUME_ROLE = "arn:aws:iam::999888777666:role/CrossAccountRole";

    const provider = new AwsProvider({ region: "us-east-1" });
    provider.s3("bucket");
    provider.opensearchServerless("https://collection.us-east-1.aoss.amazonaws.com");

    const s3Config = s3CtorMock.mock.calls[0]?.[0] as { credentials?: () => Promise<unknown> };
    const credentialsProvider = s3Config.credentials;

    await credentialsProvider?.();

    const openSearchCredentialsProvider = openSearchClientImplCtorMock.mock.calls[0]?.[2] as () => Promise<unknown>;
    await openSearchCredentialsProvider();

    expect(stsSendMock).toHaveBeenCalledTimes(1);
  });
});
