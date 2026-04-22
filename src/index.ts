// Provider
export { AwsProvider } from "./providers/aws.provider.js";

// Config
export type { AwsCredentialInput, AwsCredentials, AwsProviderConfig } from "./config/aws.config.js";

// Errors
export { AwsClientError, NotImplementedError } from "./errors/aws-client.error.js";

// Concrete clients (para instanciação direta sem o provider)
export { S3ClientImpl } from "./clients/s3.client.js";
export { SQSClientImpl } from "./clients/sqs.client.js";
export { DynamoClientImpl } from "./clients/dynamo.client.js";
export { BedrockClientImpl } from "./clients/bedrock.client.js";
export { OpenSearchServerlessClientImpl } from "./clients/opensearch-serverless.client.js";
export { StsClientImpl } from "./clients/sts.client.js";

// Interfaces
export type { IS3Client } from "./interfaces/s3.interface.js";
export type { ISQSClient } from "./interfaces/sqs.interface.js";
export type { IDynamoClient } from "./interfaces/dynamo.interface.js";
export type { IBedrockClient } from "./interfaces/bedrock.interface.js";
export type { IOpenSearchClient } from "./interfaces/opensearch.interface.js";
export type { IStsClient } from "./interfaces/sts.interface.js";

// Orchestration
export { RagAgentOrchestrator } from "./orchestration/rag-agent.orchestrator.js";
export type { IRagAgentOrchestrator } from "./interfaces/rag-agent.interface.js";

// Types
export * from "./types/common.types.js";
export * from "./types/s3.types.js";
export * from "./types/sqs.types.js";
export * from "./types/dynamo.types.js";
export * from "./types/bedrock.types.js";
export * from "./types/opensearch.types.js";
export * from "./types/sts.types.js";
export * from "./types/rag-agent.types.js";
