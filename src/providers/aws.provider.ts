import { S3Client as S3SDKClient } from "@aws-sdk/client-s3";
import { SQSClient as SQSSdkClient } from "@aws-sdk/client-sqs";
import { DynamoDBClient as DynamoSDKClient } from "@aws-sdk/client-dynamodb";
import { BedrockAgentClient } from "@aws-sdk/client-bedrock-agent";
import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { STSClient as STSSDKClient } from "@aws-sdk/client-sts";
import { AssumeRoleCommand } from "@aws-sdk/client-sts";
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

export class AwsProvider {
  private _s3Sdk?: S3SDKClient;
  private _sqsSdk?: SQSSdkClient;
  private _dynamoSdk?: DynamoSDKClient;
  private _bedrockAgentSdk?: BedrockAgentClient;
  private _bedrockRuntimeSdk?: BedrockAgentRuntimeClient;
  private _stsSdk?: STSSDKClient;
  private _resolvedCredentials?: AwsProviderConfig["credentials"];

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
    const sdkConfig: {
      region: string;
      credentials?: Exclude<AwsProviderConfig["credentials"], undefined>;
      endpoint?: string;
    } = {
      region: this.config.region,
    };

    const credentials = this.resolveCredentials();
    if (credentials !== undefined) {
      sdkConfig.credentials = credentials;
    }

    if (this.config.endpoint !== undefined) {
      sdkConfig.endpoint = this.config.endpoint;
    }

    return sdkConfig;
  }

  private resolveCredentials(): AwsProviderConfig["credentials"] {
    if (this._resolvedCredentials !== undefined) {
      return this._resolvedCredentials;
    }

    if (this.config.credentials !== undefined) {
      this._resolvedCredentials = this.config.credentials;
      return this._resolvedCredentials;
    }

    const assumeRoleArn = process.env.AWS_ASSUME_ROLE?.trim();

    if (!assumeRoleArn) {
      return undefined;
    }

    const baseCredentialsProvider = defaultProvider();
    const stsClient = new STSSDKClient({
      region: this.config.region,
      ...(this.config.endpoint !== undefined && { endpoint: this.config.endpoint }),
      credentials: baseCredentialsProvider,
    });

    let cachedCredentials:
      | { accessKeyId: string; secretAccessKey: string; sessionToken?: string; expiration?: Date }
      | undefined;

    const refreshBeforeMs = 5 * 60 * 1000;

    this._resolvedCredentials = (async () => {
      const now = Date.now();
      if (
        cachedCredentials?.accessKeyId &&
        cachedCredentials.secretAccessKey &&
        (cachedCredentials.expiration === undefined || cachedCredentials.expiration.getTime() - now > refreshBeforeMs)
      ) {
        return cachedCredentials;
      }

      const output = await stsClient.send(new AssumeRoleCommand({
        RoleArn: assumeRoleArn,
        RoleSessionName: `aws-client-${Date.now()}`,
      }));

      const credentials = output.Credentials;

      if (!credentials?.AccessKeyId || !credentials.SecretAccessKey) {
        throw new Error("AWS STS assume role did not return valid credentials");
      }

      cachedCredentials = {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        ...(credentials.SessionToken !== undefined && { sessionToken: credentials.SessionToken }),
        ...(credentials.Expiration !== undefined && { expiration: credentials.Expiration }),
      };

      return cachedCredentials;
    }) satisfies AwsCredentialIdentityProvider;

    return this._resolvedCredentials;
  }
}
