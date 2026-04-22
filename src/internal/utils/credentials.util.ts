import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import type { AwsCredentialIdentityProvider } from "@aws-sdk/types";
import type { AwsProviderConfig } from "../../config/aws.config.js";

const DEFAULT_ASSUME_ROLE_SESSION_PREFIX = "aws-client";

function resolveRoleSessionName(): string {
  return process.env.AWS_ASSUME_ROLE_SESSION_NAME ?? `${DEFAULT_ASSUME_ROLE_SESSION_PREFIX}-${Date.now()}`;
}

export function createCredentialProvider(credentials?: AwsProviderConfig["credentials"]): AwsCredentialIdentityProvider {
  if (typeof credentials === "function") {
    return credentials;
  }

  if (credentials !== undefined) {
    return async () => credentials;
  }

  const roleArn = process.env.AWS_ASSUME_ROLE;

  if (roleArn) {
    return fromTemporaryCredentials({
      masterCredentials: defaultProvider(),
      params: {
        RoleArn: roleArn,
        RoleSessionName: resolveRoleSessionName(),
      },
    });
  }

  return defaultProvider();
}
