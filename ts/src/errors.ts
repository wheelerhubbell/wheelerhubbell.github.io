export type ErrorCode =
  | "TERMS_REJECTED" | "SIGNATURE_FAILED" | "SETTLEMENT_REJECTED" | "PAYMENT_NOT_ACCEPTED"
  | "HTTP_ERROR" | "INVALID_RESPONSE" | "INVALID_INPUT" | "RESULT_MISMATCH" | "NOT_READY";

export class StandingError extends Error {
  readonly code: ErrorCode;
  readonly status?: number;
  readonly detail?: unknown;
  constructor(code: ErrorCode, message: string, opts: { status?: number; detail?: unknown } = {}) {
    super(message);
    this.name = "StandingError";
    this.code = code;
    if (opts.status !== undefined) this.status = opts.status;
    if (opts.detail !== undefined) this.detail = opts.detail;
  }
}
