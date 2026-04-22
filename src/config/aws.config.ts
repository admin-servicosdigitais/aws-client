import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export type AwsCredentialInput = AwsCredentials | AwsCredentialIdentityProvider;

export interface AwsProviderConfig {
  region: string;
  credentials?: AwsCredentialInput;
  endpoint?: string;
}
