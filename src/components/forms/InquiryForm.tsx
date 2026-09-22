import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FormKind } from '@/lib/types';
import { ApiError, forms } from '@/lib/api';
import { hasPhoneOrEmail, isEmail, isPhone, required } from '@/lib/validate';
import { FormStatus, PrimaryButton, Select, TextArea, TextInput } from './fields';

export type FieldSpec = {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  options?: string[];
  autoComplete?: string;
};

interface Props {
  kind: FormKind;
  fields: FieldSpec[];
  submitLabel: string;
  /** Require at least one of phone and email instead of requiring email. */
  phoneOrEmail?: boolean;
  successTitle: string;
  successBody?: ReactNode;
  idPrefix?: string;
}

/**
 * One form component for contact, partnership, and membership interest.
 * Validation says what to fix and never clears what was typed. Submissions go
 * to /api/forms/[kind], which stores them and emails the Guild.
 */
export default function InquiryForm({
  kind,
  fields,
  submitLabel,
  phoneOrEmail = false,
  successTitle,
  successBody,
  idPrefix = kind,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, ''])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [honey, setHoney] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  const fid = (id: string) => `${idPrefix}-${id}`;
  const set = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = values[f.id] ?? '';
      if (f.required && !required(v))
        e[f.id] =
          f.type === 'textarea' ? 'A sentence or two is enough.' : 'Needed so we can follow up.';
      else if (f.type === 'email' && v.trim() && !isEmail(v))
        e[f.id] = 'That email is missing something, like the part after @.';
      else if (f.type === 'tel' && v.trim() && !isPhone(v)) e[f.id] = 'Ten digits with area code.';
    }
    if (
      phoneOrEmail &&
      !hasPhoneOrEmail(values.phone ?? '', values.email ?? '') &&
      !e.phone &&
      !e.email
    ) {
      e.phone = 'A phone number or an email, whichever you check.';
    }
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#${fid(first)}`)?.focus();
      return;
    }
    setPending(true);
    setSubmitError('');
    try {
      await forms.submit(kind, { ...values, website: honey });
      setSent(true);
      setTimeout(() => doneRef.current?.focus(), 0);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(err.fields);
        const firstField = Object.keys(err.fields)[0];
        formRef.current?.querySelector<HTMLElement>(`#${fid(firstField)}`)?.focus();
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not send. Try again.');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="border-brass bg-paper border-t-4 p-6 md:p-8" role="status">
        <h3 ref={doneRef} tabIndex={-1} className="text-h3 outline-none">
          {successTitle}
        </h3>
        <div className="mt-3 flex max-w-[56ch] flex-col gap-3 leading-relaxed">{successBody}</div>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      {fields.map((f) => {
        const common = {
          id: fid(f.id),
          label: f.label,
          hint: f.hint,
          error: errors[f.id],
          optional: f.optional,
          value: values[f.id] ?? '',
          autoComplete: f.autoComplete,
        };
        if (f.type === 'textarea') {
          return <TextArea key={f.id} {...common} onChange={(e) => set(f.id, e.target.value)} />;
        }
        if (f.type === 'select') {
          return (
            <Select key={f.id} {...common} onChange={(e) => set(f.id, e.target.value)}>
              <option value="">Choose one</option>
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          );
        }
        return (
          <TextInput
            key={f.id}
            {...common}
            type={f.type ?? 'text'}
            inputMode={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : undefined}
            onChange={(e) => set(f.id, e.target.value)}
          />
        );
      })}
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="absolute top-auto -left-[9999px] h-px w-px overflow-hidden"
          aria-hidden="true"
        >
          <label htmlFor={fid('website')}>Leave this empty</label>
          <input
            id={fid('website')}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honey}
            onChange={(e) => setHoney(e.target.value)}
          />
        </div>
        {submitError && !pending && (
          <p
            role="alert"
            className="border-brick bg-paper text-brick border-l-4 px-4 py-3 font-sans font-semibold"
          >
            {submitError}
          </p>
        )}
        <PrimaryButton pending={pending}>{submitLabel}</PrimaryButton>
        {pending && <FormStatus>Sending.</FormStatus>}
      </div>
    </form>
  );
}
