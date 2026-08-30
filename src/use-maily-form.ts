import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { submitForm } from './submit-form';
import type {
  SubmissionData,
  SubmissionReceipt,
  SubmitFormOptions,
} from './types';

export type MailyFormStatus = 'idle' | 'submitting' | 'success' | 'error';

export type UseMailyFormOptions = Pick<SubmitFormOptions, 'baseUrl'>;

export interface UseMailyFormResult {
  status: MailyFormStatus;
  isSubmitting: boolean;
  receipt: SubmissionReceipt | null;
  error: unknown;
  submit: (data: SubmissionData) => Promise<SubmissionReceipt>;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  reset: () => void;
}

/** Manage a MailyForm submission and its UI state from a React component. */
export function useMailyForm(
  publicId: string,
  options: UseMailyFormOptions = {},
): UseMailyFormResult {
  const baseUrl = options.baseUrl;
  const [status, setStatus] = useState<MailyFormStatus>('idle');
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [error, setError] = useState<unknown>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

  const cancelActiveRequest = useCallback(() => {
    requestSequenceRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancelActiveRequest();
    setStatus('idle');
    setReceipt(null);
    setError(null);
  }, [cancelActiveRequest]);

  const submit = useCallback(
    async (data: SubmissionData): Promise<SubmissionReceipt> => {
      cancelActiveRequest();

      const controller = new AbortController();
      const requestSequence = requestSequenceRef.current;
      controllerRef.current = controller;

      setStatus('submitting');
      setReceipt(null);
      setError(null);

      try {
        const nextReceipt = await submitForm(publicId, data, {
          ...(baseUrl === undefined ? {} : { baseUrl }),
          signal: controller.signal,
        });

        if (requestSequenceRef.current === requestSequence) {
          setReceipt(nextReceipt);
          setStatus('success');
        }

        return nextReceipt;
      } catch (reason: unknown) {
        if (requestSequenceRef.current === requestSequence) {
          setError(reason);
          setStatus('error');
        }

        throw reason;
      } finally {
        if (requestSequenceRef.current === requestSequence) {
          controllerRef.current = null;
        }
      }
    },
    [baseUrl, cancelActiveRequest, publicId],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      await submit(formDataToSubmissionData(new FormData(event.currentTarget)));
    },
    [submit],
  );

  useEffect(() => cancelActiveRequest, [cancelActiveRequest, publicId, baseUrl]);

  return {
    status,
    isSubmitting: status === 'submitting',
    receipt,
    error,
    submit,
    handleSubmit,
    reset,
  };
}

function formDataToSubmissionData(formData: FormData): SubmissionData {
  const data: SubmissionData = {};

  for (const [name, value] of formData.entries()) {
    if (typeof value !== 'string') {
      throw new TypeError('MailyForm does not support file uploads.');
    }

    const currentValue = data[name];
    if (currentValue === undefined) {
      data[name] = value;
    } else if (Array.isArray(currentValue)) {
      currentValue.push(value);
    } else {
      data[name] = [currentValue, value];
    }
  }

  return data;
}
