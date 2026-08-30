import type {
  SubmissionData,
  SubmissionReceipt,
  SubmitFormOptions,
} from './types';

const DEFAULT_BASE_URL = 'https://api.mailyform.com';

type ApiErrorBody = {
  code?: unknown;
  message?: unknown;
};

/** An error response returned by the MailyForm API. */
export class MailyFormError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(
    message: string,
    options: { status: number; code?: string; details?: unknown },
  ) {
    super(message);
    this.name = 'MailyFormError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

/** Submit flat JSON form data to a public MailyForm form. */
export async function submitForm(
  publicId: string,
  data: SubmissionData,
  options: SubmitFormOptions = {},
): Promise<SubmissionReceipt> {
  const normalizedPublicId = publicId.trim();
  if (normalizedPublicId.length === 0) {
    throw new TypeError('MailyForm public ID must not be empty.');
  }

  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseUrl}/f/${encodeURIComponent(normalizedPublicId)}`;
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };

  const response = await fetch(url, requestInit);
  const body = await parseJson(response);

  if (!response.ok) {
    const errorBody = isRecord(body) ? (body as ApiErrorBody) : undefined;
    throw new MailyFormError(readErrorMessage(errorBody, response.status), {
      status: response.status,
      ...(typeof errorBody?.code === 'string'
        ? { code: errorBody.code }
        : {}),
      details: body,
    });
  }

  if (!isSubmissionReceipt(body)) {
    throw new MailyFormError('MailyForm returned an invalid response.', {
      status: response.status,
      details: body,
    });
  }

  return body;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readErrorMessage(
  body: ApiErrorBody | undefined,
  status: number,
): string {
  if (typeof body?.message === 'string') {
    return body.message;
  }

  if (
    Array.isArray(body?.message) &&
    body.message.every((item) => typeof item === 'string')
  ) {
    return body.message.join(' ');
  }

  return `MailyForm request failed with status ${status}.`;
}

function isSubmissionReceipt(value: unknown): value is SubmissionReceipt {
  return (
    isRecord(value) &&
    typeof value.submissionId === 'string' &&
    typeof value.receivedAt === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
