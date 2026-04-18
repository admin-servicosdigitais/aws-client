export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface AwsProviderConfig {
  region: string;
  credentials?: AwsCredentials;
  endpoint?: string;
}
