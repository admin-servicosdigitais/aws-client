import type { STSClient as STSSDKClient } from "@aws-sdk/client-sts";
import type { AwsCredentials } from "../config/aws.config.js";
import type { IStsClient } from "../interfaces/sts.interface.js";
import type {
  AssumeRoleOptions,
  AssumeRoleWithWebIdentityOptions,
  CallerIdentity,
} from "../types/sts.types.js";
import { NotImplementedError } from "../errors/aws-client.error.js";

export class StsClientImpl implements IStsClient {
  constructor(private readonly sdk: STSSDKClient) {}

  assumeRole(
    _roleArn: string,
    _sessionName: string,
    _options?: AssumeRoleOptions,
  ): Promise<AwsCredentials> {
    throw new NotImplementedError("StsClientImpl.assumeRole");
  }

  assumeRoleWithWebIdentity(
    _roleArn: string,
    _sessionName: string,
    _webIdentityToken: string,
    _options?: AssumeRoleWithWebIdentityOptions,
  ): Promise<AwsCredentials> {
    throw new NotImplementedError("StsClientImpl.assumeRoleWithWebIdentity");
  }

  getCallerIdentity(): Promise<CallerIdentity> {
    throw new NotImplementedError("StsClientImpl.getCallerIdentity");
  }
}
