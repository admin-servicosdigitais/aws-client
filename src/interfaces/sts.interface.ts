import type { AwsCredentials } from "../config/aws.config.js";
import type {
  AssumeRoleOptions,
  AssumeRoleWithWebIdentityOptions,
  CallerIdentity,
} from "../types/sts.types.js";

export interface IStsClient {
  assumeRole(
    roleArn: string,
    sessionName: string,
    options?: AssumeRoleOptions,
  ): Promise<AwsCredentials>;

  assumeRoleWithWebIdentity(
    roleArn: string,
    sessionName: string,
    webIdentityToken: string,
    options?: AssumeRoleWithWebIdentityOptions,
  ): Promise<AwsCredentials>;

  getCallerIdentity(): Promise<CallerIdentity>;
}
