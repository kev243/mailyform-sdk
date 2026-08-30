// @vitest-environment jsdom

import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitForm } from './submit-form';
import { useMailyForm } from './use-maily-form';

vi.mock('./submit-form', async (importOriginal) => {
  const original = await importOriginal<typeof import('./submit-form')>();
  return { ...original, submitForm: vi.fn() };
});

const submitFormMock = vi.mocked(submitForm);

describe('useMailyForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('moves from idle to submitting and then success', async () => {
    const receipt = {
      submissionId: 'submission_123',
      receivedAt: '2026-08-11T12:00:00.000Z',
    };
    let resolveRequest: (value: typeof receipt) => void = () => undefined;
    submitFormMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const { result } = renderHook(() => useMailyForm('f_123'));

    let request: Promise<typeof receipt>;
    act(() => {
      request = result.current.submit({ email: 'ada@example.com' });
    });
    expect(result.current.status).toBe('submitting');
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveRequest(receipt);
      await request;
    });

    expect(result.current.status).toBe('success');
    expect(result.current.receipt).toEqual(receipt);
    expect(result.current.error).toBeNull();
  });

  it('exposes a failed submission and lets the caller reset it', async () => {
    const apiError = new Error('Request failed');
    submitFormMock.mockRejectedValue(apiError);
    const { result } = renderHook(() => useMailyForm('f_123'));

    await act(async () => {
      await expect(result.current.submit({ message: 'Hello' })).rejects.toBe(
        apiError,
      );
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(apiError);

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('passes baseUrl and an internally managed signal to submitForm', async () => {
    submitFormMock.mockResolvedValue({
      submissionId: 'submission_123',
      receivedAt: '2026-08-11T12:00:00.000Z',
    });
    const { result } = renderHook(() =>
      useMailyForm('f_123', { baseUrl: 'http://localhost:3000' }),
    );

    await act(() => result.current.submit({ message: 'Hello' }));

    expect(submitFormMock).toHaveBeenCalledWith(
      'f_123',
      { message: 'Hello' },
      {
        baseUrl: 'http://localhost:3000',
        signal: expect.any(AbortSignal),
      },
    );
  });

  it('aborts an active request when the component unmounts', async () => {
    submitFormMock.mockImplementation((_publicId, _data, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    const { result, unmount } = renderHook(() => useMailyForm('f_123'));

    let request: Promise<unknown>;
    act(() => {
      request = result.current.submit({ message: 'Hello' });
    });
    unmount();

    await waitFor(() => expect(request).rejects.toMatchObject({ name: 'AbortError' }));
  });

  it('collects named form fields through handleSubmit', async () => {
    submitFormMock.mockResolvedValue({
      submissionId: 'submission_123',
      receivedAt: '2026-08-11T12:00:00.000Z',
    });

    function ContactForm() {
      const { handleSubmit } = useMailyForm('f_123');

      return createElement(
        'form',
        { onSubmit: handleSubmit },
        createElement('input', {
          name: 'email',
          defaultValue: 'ada@example.com',
        }),
        createElement('input', {
          name: 'interests',
          value: 'API',
          defaultChecked: true,
          type: 'checkbox',
        }),
        createElement('input', {
          name: 'interests',
          value: 'React',
          defaultChecked: true,
          type: 'checkbox',
        }),
        createElement('button', { type: 'submit' }, 'Send'),
      );
    }

    const { getByRole } = render(createElement(ContactForm));
    fireEvent.submit(getByRole('button'));

    await waitFor(() => {
      expect(submitFormMock).toHaveBeenCalledWith(
        'f_123',
        {
          email: 'ada@example.com',
          interests: ['API', 'React'],
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });
});
