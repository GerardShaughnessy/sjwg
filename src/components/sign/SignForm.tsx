import { useEffect, useState } from 'react';
import { btnPrimary, btnQuiet, ErrorStrip, inputCls, Labeled, msg } from '../portal/ui';

interface Props {
  title: string;
  html: string;
  draft: boolean;
  draftNotice: string;
  signerName: string;
  docSha256: string;
  consentText: string[];
  consentSha256: string;
  /** Where the signature is posted: /api/sign/<token> or /api/sign/request/<id>. */
  endpoint: string;
  /** Where the signed PDF can be downloaded once signed. */
  pdfUrl: string;
  /**
   * Posted once when a real browser shows the page. Email link scanners fetch
   * the page but do not run scripts, so they never count as a view.
   */
  viewUrl?: string;
}

/**
 * Two steps: consent to electronic records, then read and sign. The document
 * HTML is our own frozen copy, rendered as is so what is shown is what is hashed.
 */
export default function SignForm(p: Props) {
  const [step, setStep] = useState<'consent' | 'sign' | 'done'>('consent');
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    signedAt?: string;
    hasPdf: boolean;
    emailed: boolean;
  } | null>(null);

  useEffect(() => {
    if (p.viewUrl) fetch(p.viewUrl, { method: 'POST' }).catch(() => {});
  }, [p.viewUrl]);

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const f: Record<string, string> = {};
    if (name.trim().length < 2) f.signedName = 'Type your full legal name.';
    if (!agree) f.agree = 'Check the box to agree.';
    setFields(f);
    if (Object.keys(f).length) return;
    setPending(true);
    try {
      const res = await fetch(p.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          consent: true,
          consentSha256: p.consentSha256,
          signedName: name.trim(),
          agree: true,
          docSha256: p.docSha256,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFields(body.fields ?? {});
        throw new Error(body.error ?? `Something went wrong (${res.status}).`);
      }
      setResult(body);
      setStep('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(msg(err, 'Could not record your signature. Try again.'));
    } finally {
      setPending(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="flex max-w-[60ch] flex-col gap-4 font-sans" role="status">
        <h2 className="text-h2 font-serif">Thank you. It is signed.</h2>
        <p className="text-[1.0625rem] leading-relaxed">
          {name.trim()} signed the {p.title}
          {result?.signedAt
            ? ` on ${new Date(result.signedAt).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'long', timeStyle: 'short' })}`
            : ''}
          .
          {result?.emailed
            ? ' A PDF copy is on its way to your email.'
            : ' We could not email your copy just now. The Guild has your signature on file.'}
        </p>
        {result?.hasPdf && (
          <p>
            <a href={p.pdfUrl} className={btnPrimary + ' inline-block no-underline'}>
              Download the signed PDF
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 font-sans">
      {p.draft && (
        <p
          role="note"
          className="border-brick bg-brick text-paper px-4 py-3 text-[1.0625rem] font-semibold"
        >
          {p.draftNotice} This copy is for review and testing.
        </p>
      )}

      <ol className="text-ash flex gap-6 text-[0.95rem]" aria-label="Steps">
        <li className={step === 'consent' ? 'text-charcoal font-semibold' : ''}>1. Consent</li>
        <li className={step === 'sign' ? 'text-charcoal font-semibold' : ''}>2. Read and sign</li>
      </ol>

      {step === 'consent' && (
        <section className="border-charcoal bg-paper flex max-w-[65ch] flex-col gap-4 border-2 p-5 md:p-6">
          <h2 className="text-h3 font-serif">{p.consentText[0]}</h2>
          {p.consentText.slice(1).map((t) => (
            <p key={t} className="leading-relaxed">
              {t}
            </p>
          ))}
          <label className="flex items-start gap-3 font-semibold">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 size-5"
            />
            <span>I agree to use electronic records and signatures for this document.</span>
          </label>
          <div>
            <button
              type="button"
              className={btnPrimary}
              disabled={!consent}
              onClick={() => setStep('sign')}
            >
              Continue to the document
            </button>
          </div>
        </section>
      )}

      {step === 'sign' && (
        <>
          <section aria-label={p.title}>
            <div
              tabIndex={0}
              className="border-charcoal bg-paper prose prose-stone [&_.draft-notice]:text-brick [&_.doc-meta]:text-ash max-h-[65vh] max-w-none overflow-y-auto border-2 p-5 font-serif md:p-8 [&_.doc-meta]:font-sans [&_.doc-meta]:text-[0.9rem]"
              dangerouslySetInnerHTML={{ __html: p.html }}
            />
            <p className="text-ash mt-2 text-[0.9rem]">
              Scroll inside the box to read the whole document.
            </p>
          </section>

          <form onSubmit={sign} className="flex max-w-[48ch] flex-col gap-5" noValidate>
            <p className="leading-relaxed">
              This was sent to <span className="font-semibold">{p.signerName}</span>. Your typed
              name is your signature.
            </p>
            <Labeled label="Type your full legal name *" error={fields.signedName}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls + ' font-serif text-[1.25rem]'}
                autoComplete="name"
                required
                maxLength={120}
              />
            </Labeled>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-1 size-5"
                required
              />
              <span className="font-semibold">
                I have read this document and agree to sign it electronically *
              </span>
            </label>
            {fields.agree && (
              <span role="alert" className="text-brick -mt-3 text-[0.95rem] font-semibold">
                {fields.agree}
              </span>
            )}
            {error && <ErrorStrip>{error}</ErrorStrip>}
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" className={btnPrimary} disabled={pending}>
                {pending ? 'Signing.' : 'Sign'}
              </button>
              <button type="button" className={btnQuiet} onClick={() => setStep('consent')}>
                Back to consent
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
