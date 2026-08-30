import { afterEach, describe, expect, it, vi } from 'vitest';
import { MailyFormError, submitForm } from './submit-form';

describe('submitForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts JSON to the public form endpoint and returns its receipt', async () => {
    const receipt = {
      submissionId: 'submission_123',
      receivedAt: '2026-08-11T12:00:00.000Z',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(receipt), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      submitForm(
        'f_public/id',
        { email: 'ada@example.com', newsletter: true },
        { baseUrl: 'http://localhost:3000/' },
      ),
    ).resolves.toEqual(receipt);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/f/f_public%2Fid',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'ada@example.com',
          newsletter: true,
        }),
      }),
    );
  });

  it('rejects an empty public ID before issuing a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitForm('  ', { message: 'Hello' })).rejects.toThrow(
      TypeError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns an API response into a MailyFormError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            statusCode: 429,
            message: 'Submission quota exceeded.',
            code: 'FORM_DAILY_SUBMISSION_QUOTA_EXCEEDED',
          }),
          { status: 429 },
        ),
      ),
    );

    const error = await submitForm('f_123', { message: 'Hello' }).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(MailyFormError);
    expect(error).toMatchObject({
      status: 429,
      message: 'Submission quota exceeded.',
      code: 'FORM_DAILY_SUBMISSION_QUOTA_EXCEEDED',
    });
  });

  it('forwards the AbortSignal to fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          submissionId: 'submission_123',
          receivedAt: '2026-08-11T12:00:00.000Z',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await submitForm('f_123', { message: 'Hello' }, { signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
