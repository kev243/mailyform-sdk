# MailyForm

The official JavaScript and React SDK for sending forms to MailyForm.

```ts
import { submitForm } from 'mailyform';
import { useMailyForm } from 'mailyform/react';
```

## Installation

```bash
npm install mailyform
```

Only one package is required. `mailyform/react` is an entry point of the `mailyform` package, not a separate package to install.

Requirements:

- Node.js 18 or later for server-side usage;
- React 18 or 19 to use `mailyform/react`;
- a `publicId` provided by MailyForm.

## React usage

```tsx
import { useMailyForm } from 'mailyform/react';

export function ContactForm() {
  const { handleSubmit, status, isSubmitting, error } =
    useMailyForm('YOUR_PUBLIC_ID');

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Your name" required />
      <input name="email" type="email" placeholder="Your email" required />
      <textarea name="message" placeholder="Your message" required />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send'}
      </button>

      {status === 'success' && <p>Your message has been sent.</p>}
      {status === 'error' && (
        <p>
          {error instanceof Error
            ? error.message
            : 'Something went wrong.'}
        </p>
      )}
    </form>
  );
}
```

## Next.js usage

With the App Router, use the hook inside a Client Component:

```tsx
'use client';

import { useMailyForm } from 'mailyform/react';

export default function ContactPage() {
  const { handleSubmit, status, isSubmitting } =
    useMailyForm('YOUR_PUBLIC_ID');

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <textarea name="message" required />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send'}
      </button>

      {status === 'success' && <p>Message sent!</p>}
      {status === 'error' && <p>Unable to send your message.</p>}
    </form>
  );
}
```

## Usage without React

`submitForm` works in the browser, in Node.js 18+, and in Next.js server routes.

```ts
import { submitForm } from 'mailyform';

const receipt = await submitForm('YOUR_PUBLIC_ID', {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hello!',
  newsletter: true,
  interests: ['API', 'Automation'],
});

console.log(receipt.submissionId);
console.log(receipt.receivedAt);
```

All submissions are automatically sent to the public MailyForm API:

```text
POST https://api.mailyform.com/f/:publicId
```

## React API

### `useMailyForm(publicId, options?)`

The hook returns:

| Property | Type | Description |
| --- | --- | --- |
| `handleSubmit` | `(event) => Promise<void>` | Automatically collects and submits the fields of a `<form>`. |
| `submit` | `(data) => Promise<SubmissionReceipt>` | Submits data programmatically. |
| `status` | `'idle' \| 'submitting' \| 'success' \| 'error'` | Current form status. |
| `isSubmitting` | `boolean` | `true` while a submission is in progress. |
| `receipt` | `SubmissionReceipt \| null` | Receipt from the latest successful submission. |
| `error` | `unknown` | Most recent error. |
| `reset` | `() => void` | Cancels the active request and resets the state. |

Starting a new submission cancels the previous one. The active request is also canceled when the component unmounts or its configuration changes.

`handleSubmit` automatically calls `preventDefault()` and collects every field with a `name` attribute. Fields sharing the same name are submitted as an array. File uploads are not currently supported.

## Core API

### `submitForm(publicId, data, options?)`

```ts
function submitForm(
  publicId: string,
  data: SubmissionData,
  options?: {
    baseUrl?: string;
    signal?: AbortSignal;
  },
): Promise<SubmissionReceipt>;
```

The receipt has the following shape:

```ts
interface SubmissionReceipt {
  submissionId: string;
  receivedAt: string; // ISO 8601 date
}
```

### Accepted data

A submission is a flat object. Each field accepts a string, a finite number, a boolean, `null`, or an array of those values:

```ts
type SubmissionScalar = string | number | boolean | null;
type SubmissionData = Record<
  string,
  SubmissionScalar | SubmissionScalar[]
>;
```

Nested objects are not supported.

API limits:

- 50 form fields per submission;
- 100 characters maximum per field name;
- 10,000 characters maximum per string;
- 20 items maximum per array;
- 50,000 bytes maximum for the JSON payload.

## Optional spam protection

The `_gotcha` honeypot field is optional. The API works normally without it.

You can add it to help MailyForm detect bots that automatically fill every field:

```tsx
<input
  name="_gotcha"
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
  style={{ position: 'absolute', left: '-9999px' }}
/>
```

Human visitors should always leave this field empty. When it contains a value, the submission may be classified as spam and no notification is sent.

## Error handling

HTTP error responses produce a `MailyFormError` instance:

```ts
import { MailyFormError, submitForm } from 'mailyform';

try {
  await submitForm('YOUR_PUBLIC_ID', {
    message: 'Hello',
  });
} catch (error) {
  if (error instanceof MailyFormError) {
    console.error(error.status);  // For example: 400, 404, or 429
    console.error(error.code);    // Optional code returned by the API
    console.error(error.message);
  } else {
    // Network error or request cancellation.
    console.error(error);
  }
}
```

Main response statuses:

| Status | Meaning |
| --- | --- |
| `201` | Submission recorded. |
| `400` | Missing or invalid data. |
| `404` | Unknown `publicId` or unavailable form. |
| `429` | Traffic limit or submission quota reached. |

## License

MIT
