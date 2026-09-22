import type { ReactNode } from 'react';

/** Small shared pieces for the portal editors. Hard edges, no shadows. */
export const inputCls = 'border-charcoal bg-paper border-2 px-3 py-2 font-sans';
export const btnPrimary =
  'bg-brick text-paper hover:bg-kiln px-4 py-2.5 font-sans font-semibold disabled:opacity-60';
export const btnSecondary =
  'border-charcoal hover:bg-charcoal hover:text-stone border-2 px-4 py-2 font-sans font-semibold disabled:opacity-40';
export const btnQuiet =
  'decoration-brass px-1 py-1 text-left font-sans font-medium underline decoration-2 underline-offset-4';
export const btnMuted =
  'text-ash decoration-mortar px-1 py-1 text-left font-sans font-medium underline decoration-2 underline-offset-4';

export function Labeled({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1 font-sans">
      <span className="font-semibold">{label}</span>
      {hint && <span className="text-ash text-[0.9rem]">{hint}</span>}
      {children}
      {error && (
        <span role="alert" className="text-brick text-[0.95rem] font-semibold">
          {error}
        </span>
      )}
    </label>
  );
}

export function Status({ children }: { children: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="text-ash font-sans text-[0.9rem]">
      {children}
    </p>
  );
}

export function ErrorStrip({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-brick bg-paper text-brick border-l-4 px-4 py-3 font-sans font-semibold"
    >
      {children}
    </p>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <p className="text-ash font-sans" aria-busy="true">
      Loading {what}.
    </p>
  );
}

/** Says what happened to the public site after a change. */
export function rebuildNote(r: 'triggered' | 'coalesced' | 'no-hook' | null | undefined): string {
  if (r === 'triggered') return 'The public site is rebuilding; give it a minute or two.';
  if (r === 'coalesced') return 'The public site will rebuild shortly.';
  if (r === 'no-hook') return 'Saved. The public site will update at the next scheduled rebuild.';
  return '';
}

export function msg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
