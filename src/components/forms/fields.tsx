import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/**
 * Form primitives shared by the request wizard, contact, partner, and
 * membership forms. Large targets, hard edges, errors that say what to fix.
 */

export const inputCls =
  'w-full border-2 border-charcoal bg-paper px-4 py-3 font-sans text-[1.0625rem] leading-snug placeholder:text-ash/70 aria-[invalid=true]:border-brick';

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-sans text-[1.0625rem] leading-snug font-semibold">
        {label}
        {optional && <span className="text-ash ml-2 font-normal">(optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-ash font-sans text-[0.95rem] leading-snug">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p
          id={`${id}-error`}
          className="text-brick font-sans text-[0.95rem] leading-snug font-semibold"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: string) {
  return (
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  );
}

export function TextInput({
  id,
  label,
  hint,
  error,
  optional,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        className={inputCls}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </Field>
  );
}

export function TextArea({
  id,
  label,
  hint,
  error,
  optional,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        className={`${inputCls} min-h-[10rem] resize-y leading-relaxed`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </Field>
  );
}

export function Select({
  id,
  label,
  hint,
  error,
  optional,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        className={inputCls}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
}

export type RadioOption = { value: string; label: string; detail?: string };

/** Big-target radio list. Whole row is the label. */
export function RadioGroup({
  name,
  legend,
  hint,
  error,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  hint?: ReactNode;
  error?: string;
  options: RadioOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const errId = `${name}-error`;
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? errId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="font-sans text-[1.0625rem] leading-snug font-semibold">{legend}</legend>
      {hint && <p className="text-ash font-sans text-[0.95rem] leading-snug">{hint}</p>}
      <div className="border-mortar mt-1 flex flex-col border-t">
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={`border-mortar flex cursor-pointer items-start gap-4 border-b px-3 py-4 ${checked ? 'bg-paper' : ''}`}
            >
              <input
                type="radio"
                id={id}
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="accent-brick mt-1.5 h-5 w-5 shrink-0"
              />
              <span className="flex flex-col">
                <span className="font-sans text-[1.0625rem] leading-snug font-semibold">
                  {o.label}
                </span>
                {o.detail && (
                  <span className="text-ash font-sans text-[0.95rem] leading-snug">{o.detail}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p
          id={errId}
          className="text-brick font-sans text-[0.95rem] leading-snug font-semibold"
          role="alert"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function PrimaryButton({
  children,
  pending,
  pendingLabel = 'Sending',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean; pendingLabel?: string }) {
  return (
    <button
      type="submit"
      className="bg-brick text-paper hover:bg-kiln inline-flex min-h-[3.25rem] items-center justify-center gap-3 px-7 py-3 font-sans text-[1.0625rem] leading-none font-semibold disabled:cursor-wait disabled:opacity-80"
      disabled={pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? (
        <>
          <span
            className="bg-paper inline-block h-3 w-3 animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="border-charcoal hover:bg-charcoal hover:text-stone inline-flex min-h-[3.25rem] items-center justify-center border-2 px-6 py-3 font-sans text-[1.0625rem] leading-none font-semibold"
      {...rest}
    >
      {children}
    </button>
  );
}

/** Announces submit progress and results to assistive tech. */
export function FormStatus({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="text-ash font-sans text-[0.95rem]">
      {children}
    </p>
  );
}
