export class AwsClientError extends Error {
  public override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AwsClientError";
    this.cause = cause;
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export class NotImplementedError extends AwsClientError {
  constructor(method: string) {
    super(`${method} is not yet implemented`);
    this.name = "NotImplementedError";
  }
}
