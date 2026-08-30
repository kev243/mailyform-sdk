/** A scalar value accepted by the public MailyForm endpoint. */
export type SubmissionScalar = string | number | boolean | null;

/** A single form field can contain one value or a group of values. */
export type SubmissionFieldValue = SubmissionScalar | SubmissionScalar[];

/** Flat form data sent to MailyForm. Nested objects are not supported. */
export type SubmissionData = Record<string, SubmissionFieldValue>;

export interface SubmitFormOptions {
  /** Overrides the API origin, primarily for local development and testing. */
  baseUrl?: string;

  /** Cancels the request through the standard Fetch API mechanism. */
  signal?: AbortSignal;
}

export interface SubmissionReceipt {
  submissionId: string;
  /** ISO 8601 timestamp returned by the MailyForm API. */
  receivedAt: string;
}
