import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface AwsProviderConfig {
  region: string;
  credentials?: AwsCredentials | AwsCredentialIdentityProvider;
  endpoint?: string;
}
