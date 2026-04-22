import {
  AssumeRoleCommand,
  AssumeRoleWithWebIdentityCommand,
  GetCallerIdentityCommand,
  type Credentials,
  type STSClient as STSSDKClient,
} from "@aws-sdk/client-sts";
import type { AwsCredentials } from "../config/aws.config.js";
import type { IStsClient } from "../interfaces/sts.interface.js";
import type {
  AssumeRoleOptions,
  AssumeRoleWithWebIdentityOptions,
  CallerIdentity,
} from "../types/sts.types.js";
import { AwsClientError } from "../errors/aws-client.error.js";
import { toAwsClientError } from "../internal/utils/error.util.js";

export class StsClientImpl implements IStsClient {
  constructor(private readonly sdk: STSSDKClient) {}

  assumeRole(
    roleArn: string,
    sessionName: string,
    options?: AssumeRoleOptions,
  ): Promise<AwsCredentials> {
    return this.executeWithErrorMapping("StsClientImpl.assumeRole", async () => {
      const output = await this.sdk.send(new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        DurationSeconds: options?.durationSeconds,
        ExternalId: options?.externalId,
        Policy: options?.policy,
      }));

      return this.mapCredentials(output.Credentials, "StsClientImpl.assumeRole");
    });
  }

  assumeRoleWithWebIdentity(
    roleArn: string,
    sessionName: string,
    webIdentityToken: string,
    options?: AssumeRoleWithWebIdentityOptions,
  ): Promise<AwsCredentials> {
    return this.executeWithErrorMapping("StsClientImpl.assumeRoleWithWebIdentity", async () => {
      const output = await this.sdk.send(new AssumeRoleWithWebIdentityCommand({
        RoleArn: roleArn,
        RoleSessionName: sessionName,
        WebIdentityToken: webIdentityToken,
        DurationSeconds: options?.durationSeconds,
        Policy: options?.policy,
      }));

      return this.mapCredentials(output.Credentials, "StsClientImpl.assumeRoleWithWebIdentity");
    });
  }

  getCallerIdentity(): Promise<CallerIdentity> {
    return this.executeWithErrorMapping("StsClientImpl.getCallerIdentity", async () => {
      const output = await this.sdk.send(new GetCallerIdentityCommand({}));
      const { Account, Arn, UserId } = output;

      if (!Account || !Arn || !UserId) {
        throw new AwsClientError(
          "StsClientImpl.getCallerIdentity: AWS STS returned incomplete caller identity",
          { Account, Arn, UserId },
        );
      }

      return {
        accountId: Account,
        arn: Arn,
        userId: UserId,
      };
    });
  }

  private mapCredentials(
    credentials: Credentials | undefined,
    context: string,
  ): AwsCredentials {
    if (!credentials?.AccessKeyId || !credentials.SecretAccessKey) {
      throw new AwsClientError(`${context}: AWS STS returned incomplete credentials`, credentials);
    }

    return {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      ...(credentials.SessionToken !== undefined && { sessionToken: credentials.SessionToken }),
    };
  }

  private async executeWithErrorMapping<T>(context: string, executor: () => Promise<T>): Promise<T> {
    try {
      return await executor();
    } catch (error) {
      throw toAwsClientError(error, `${context} failed`);
    }
  }
}
