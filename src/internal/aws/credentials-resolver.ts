import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from "@aws-sdk/types";
import type { AwsProviderConfig } from "../../config/aws.config.js";

const ASSUME_ROLE_ENV = "AWS_ASSUME_ROLE";
const ASSUME_ROLE_ARN_REGEX = /^arn:(aws|aws-us-gov|aws-cn):iam::\d{12}:role\/[\w+=,.@\-_/]+$/;
const EXPIRATION_SAFETY_WINDOW_MS = 60_000;

export function resolveCredentials(config: AwsProviderConfig): AwsCredentialIdentity | AwsCredentialIdentityProvider | undefined {
  const assumeRoleArn = process.env[ASSUME_ROLE_ENV]?.trim();

  if (!assumeRoleArn) {
    return config.credentials;
  }

  if (!ASSUME_ROLE_ARN_REGEX.test(assumeRoleArn)) {
    throw new Error(
      `[AwsProvider] Invalid ${ASSUME_ROLE_ENV} value: "${assumeRoleArn}". Expected a valid IAM Role ARN (example: arn:aws:iam::123456789012:role/MyRole).`,
    );
  }

  const sourceCredentials = config.credentials ?? defaultProvider();
  const stsClient = new STSClient({
    region: config.region,
    ...(config.endpoint !== undefined && { endpoint: config.endpoint }),
    credentials: sourceCredentials,
  });

  let cachedCredentials: AwsCredentialIdentity | undefined;
  let cachedExpiration: Date | undefined;
  let inflight: Promise<AwsCredentialIdentity> | undefined;

  return async () => {
    const now = Date.now();
    if (cachedCredentials && cachedExpiration && cachedExpiration.getTime() - EXPIRATION_SAFETY_WINDOW_MS > now) {
      return cachedCredentials;
    }

    if (!inflight) {
      inflight = (async () => {
        const roleSessionName = `aws-client-${Math.floor(now / 1000)}`;

        const output = await stsClient.send(
          new AssumeRoleCommand({
            RoleArn: assumeRoleArn,
            RoleSessionName: roleSessionName,
          }),
        );

        if (!output.Credentials?.AccessKeyId || !output.Credentials.SecretAccessKey) {
          throw new Error(
            `[AwsProvider] AssumeRole for ${ASSUME_ROLE_ENV}="${assumeRoleArn}" did not return temporary credentials.`,
          );
        }

        cachedCredentials = {
          accessKeyId: output.Credentials.AccessKeyId,
          secretAccessKey: output.Credentials.SecretAccessKey,
          ...(output.Credentials.SessionToken !== undefined && { sessionToken: output.Credentials.SessionToken }),
        };
        cachedExpiration = output.Credentials.Expiration;

        return cachedCredentials;
      })().finally(() => {
        inflight = undefined;
      });
    }

    return inflight!;
  };
}
