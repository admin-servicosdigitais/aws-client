import { AwsClientError } from "../../errors/aws-client.error.js";

const UNIX_MILLISECONDS_THRESHOLD = 1_000_000_000_000;

export function parseAwsDate(value: string | number | Date | null | undefined): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "number") {
    return parseFromNumber(value);
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return undefined;
  }

  const numericValue = Number(trimmedValue);
  if (!Number.isNaN(numericValue)) {
    return parseFromNumber(numericValue);
  }

  const parsed = new Date(trimmedValue);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseRequiredAwsDate(
  value: string | number | Date | null | undefined,
  fieldName: string,
): Date {
  const parsed = parseAwsDate(value);
  if (!parsed) {
    throw new AwsClientError(`Invalid AWS date for field \"${fieldName}\"`);
  }
  return parsed;
}

function parseFromNumber(value: number): Date | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const timestamp = Math.abs(value) < UNIX_MILLISECONDS_THRESHOLD ? value * 1_000 : value;
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
