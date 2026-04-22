import { S3Client as S3SDKClient } from "@aws-sdk/client-s3";
import { SQSClient as SQSSdkClient } from "@aws-sdk/client-sqs";
import { DynamoDBClient as DynamoSDKClient } from "@aws-sdk/client-dynamodb";
import { BedrockAgentClient } from "@aws-sdk/client-bedrock-agent";
import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import { STSClient as STSSDKClient } from "@aws-sdk/client-sts";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";
import type { AwsProviderConfig } from "../config/aws.config.js";
import type { IS3Client } from "../interfaces/s3.interface.js";
import type { ISQSClient } from "../interfaces/sqs.interface.js";
import type { IDynamoClient } from "../interfaces/dynamo.interface.js";
import type { IBedrockClient } from "../interfaces/bedrock.interface.js";
import type { IOpenSearchClient } from "../interfaces/opensearch.interface.js";
import type { IStsClient } from "../interfaces/sts.interface.js";
import { S3ClientImpl } from "../clients/s3.client.js";
import { SQSClientImpl } from "../clients/sqs.client.js";
import { DynamoClientImpl } from "../clients/dynamo.client.js";
import { BedrockClientImpl } from "../clients/bedrock.client.js";
import { OpenSearchServerlessClientImpl } from "../clients/opensearch-serverless.client.js";
import { StsClientImpl } from "../clients/sts.client.js";

type ResolvedCredentials = AwsProviderConfig["credentials"] | AwsCredentialIdentityProvider;

export class AwsProvider {
  private _s3Sdk?: S3SDKClient;
  private _sqsSdk?: SQSSdkClient;
  private _dynamoSdk?: DynamoSDKClient;
  private _bedrockAgentSdk?: BedrockAgentClient;
  private _bedrockRuntimeSdk?: BedrockAgentRuntimeClient;
  private _stsSdk?: STSSDKClient;
  private resolvedCredentials?: ResolvedCredentials;

  constructor(private readonly config: AwsProviderConfig) {}

  s3(bucketName: string): IS3Client {
    return new S3ClientImpl(this.getS3Sdk(), bucketName);
  }

  sqs(queueUrl: string): ISQSClient {
    return new SQSClientImpl(this.getSqsSdk(), queueUrl);
  }

  dynamo(tableName: string): IDynamoClient {
    return new DynamoClientImpl(this.getDynamoSdk(), tableName);
  }

  bedrock(): IBedrockClient {
    return new BedrockClientImpl(this.getBedrockAgentSdk(), this.getBedrockRuntimeSdk());
  }

  opensearchServerless(node: string): IOpenSearchClient {
    return new OpenSearchServerlessClientImpl(node, this.config.region, this.resolveCredentials());
  }

  sts(): IStsClient {
    this._stsSdk ??= new STSSDKClient(this.buildSdkConfig());
    return new StsClientImpl(this._stsSdk);
  }

  private getS3Sdk(): S3SDKClient {
    this._s3Sdk ??= new S3SDKClient(this.buildSdkConfig());
    return this._s3Sdk;
  }

  private getSqsSdk(): SQSSdkClient {
    this._sqsSdk ??= new SQSSdkClient(this.buildSdkConfig());
    return this._sqsSdk;
  }

  private getDynamoSdk(): DynamoSDKClient {
    this._dynamoSdk ??= new DynamoSDKClient(this.buildSdkConfig());
    return this._dynamoSdk;
  }

  private getBedrockAgentSdk(): BedrockAgentClient {
    this._bedrockAgentSdk ??= new BedrockAgentClient(this.buildSdkConfig());
    return this._bedrockAgentSdk;
  }

  private getBedrockRuntimeSdk(): BedrockAgentRuntimeClient {
    this._bedrockRuntimeSdk ??= new BedrockAgentRuntimeClient(this.buildSdkConfig());
    return this._bedrockRuntimeSdk;
  }

  private buildSdkConfig() {
    const credentials = this.resolveCredentials();

    return {
      region: this.config.region,
      ...(credentials !== undefined && { credentials }),
      ...(this.config.endpoint !== undefined && { endpoint: this.config.endpoint }),
    };
  }

  private resolveCredentials(): ResolvedCredentials | undefined {
    if (this.resolvedCredentials !== undefined) {
      return this.resolvedCredentials;
    }

    if (this.config.credentials !== undefined) {
      this.resolvedCredentials = this.config.credentials;
      return this.resolvedCredentials;
    }

    const baseCredentialsProvider = defaultProvider();
    const assumeRoleArn = process.env.AWS_ASSUME_ROLE;

    if (!assumeRoleArn) {
      this.resolvedCredentials = baseCredentialsProvider;
      return this.resolvedCredentials;
    }

    if (!/^arn:aws(-[a-z]+)?:iam::\d{12}:role\/[\w+=,.@\/-]+$/.test(assumeRoleArn)) {
      throw new Error(`Invalid AWS_ASSUME_ROLE value: ${assumeRoleArn}`);
    }

    this.resolvedCredentials = fromTemporaryCredentials({
      masterCredentials: baseCredentialsProvider,
      params: {
        RoleArn: assumeRoleArn,
        RoleSessionName: "aws-client-session",
      },
    });

    return this.resolvedCredentials;
  }
}
