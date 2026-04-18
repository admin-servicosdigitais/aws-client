export interface AssumeRoleOptions {
  durationSeconds?: number;
  externalId?: string;
  policy?: string;
}

export interface AssumeRoleWithWebIdentityOptions {
  durationSeconds?: number;
  policy?: string;
}

export interface CallerIdentity {
  accountId: string;
  arn: string;
  userId: string;
}
