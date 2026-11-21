import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { aid, shrinkPhoto } from '@/lib/api-aid';
import {
  AID_FILE_MAX_BYTES,
  AID_MAX_FILES,
  AID_TOTAL_MAX_BYTES,
  aidErrors,
  APPLICANT_TYPES,
  CONTACT_PREF_OPTIONS,
  EMPTY_AID,
  FAITH_IMPACT_LABEL,
  HELP_KIND_OPTIONS,
  isOrgType,
  ORG_NAME_LABEL,
  TEACHERS_OPTIONS,
  URGENCY_OPTIONS,
  type AidAnswers,
  type HelpKind,
} from '@/lib/aid';
import {
  FormStatus,
  PrimaryButton,
  RadioGroup,
  Select,
  TextArea,
  TextInput,
} from '@/components/forms/fields';

const P = 'aid';
const fid = (f: string) => `${P}-${f}`;
/** Where focus goes for a field with an error. Radio groups focus their first option. */
function focusId(f: string): string {
  if (f === 'applicantType') return `${P}-applicantType-${APPLICANT_TYPES[0].value}`;
  if (f === 'teachersCatholic') return `${P}-teachersCatholic-yes`;
  if (f === 'helpKinds') return `${P}-helpKinds-materials`;
  return fid(f);
}

const ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.heic,.heif';
const OK_TYPE = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/;
const OK_EXT = /\.(pdf|jpe?g|png|webp|heic|heif)$/i;
const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

function Checkbox({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-4 font-sans leading-snug">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="accent-brick mt-0.5 h-5 w-5 shrink-0"
        />
        <span className="text-[1.0625rem]">{children}</span>
      </label>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-brick font-sans text-[0.95rem] leading-snug font-semibold"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = `${P}-group-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="border-mortar flex flex-col gap-6 border-t pt-8">
      <h3 id={id} className="text-h3">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The Request Help application. One form; the first answer decides which
 * extra questions appear. Validation runs the same rules as the server
 * (src/lib/aid.ts) and never clears what was typed.
 */
export default function AidApplicationForm() {
  const [v, setV] = useState<AidAnswers>(EMPTY_AID);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [honey, setHoney] = useState('');
  const [done, setDone] = useState<{ ref: string; filesFailed: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const type = v.applicantType;
  const org = isOrgType(type);
  const personal = type === 'family' || type === 'tradesman-medical';

  function set<K extends keyof AidAnswers>(k: K, value: AidAnswers[K]) {
    setV((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors(({ [k]: _drop, ...rest }) => rest);
  }

  function toggleHelp(k: HelpKind, on: boolean) {
    set('helpKinds', on ? [...v.helpKinds, k] : v.helpKinds.filter((x) => x !== k));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    let error = '';
    const next = [...files];
    for (const f of incoming) {
      if (next.length >= AID_MAX_FILES) {
        error = `Send ${AID_MAX_FILES} files at most.`;
        break;
      }
      if (!OK_TYPE.test(f.type) && !OK_EXT.test(f.name)) {
        error = `${f.name}: use a PDF or a photo (JPEG, PNG, WebP, or HEIC).`;
        continue;
      }
      if (f.size > AID_FILE_MAX_BYTES) {
        error = `${f.name} is too big. Keep each file under 10 MB.`;
        continue;
      }
      if (f.size === 0) {
        error = `${f.name} is empty.`;
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    setErrors(({ files: _drop, ...rest }) => (error ? { ...rest, files: error } : rest));
    if (fileInput.current) fileInput.current.value = '';
  }

  function focusFirst(e: Record<string, string>) {
    const first = Object.keys(e)[0];
    if (first)
      formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(focusId(first))}`)?.focus();
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = aidErrors(v);
    setErrors(e);
    if (Object.keys(e).length) {
      focusFirst(e);
      return;
    }
    setPending(true);
    setSubmitError('');
    try {
      const ready = await Promise.all(files.map(shrinkPhoto));
      const total = ready.reduce((n, f) => n + f.size, 0);
      if (total > AID_TOTAL_MAX_BYTES) {
        const msg = `Together these files are ${mb(total)}, more than we can take at once (${mb(AID_TOTAL_MAX_BYTES)}). Send the most important ones. We can ask for the rest by email.`;
        setErrors({ files: msg });
        setSubmitError(msg);
        focusFirst({ files: msg });
        return;
      }
      const res = await aid.apply({ ...v, website: honey }, ready);
      setDone({ ref: res.ref, filesFailed: res.filesFailed ?? 0 });
      setTimeout(() => doneRef.current?.focus(), 0);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(err.fields);
        focusFirst(err.fields);
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not send. Try again.');
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="border-brass bg-paper border-t-4 p-6 md:p-8" role="status">
        <h3 ref={doneRef} tabIndex={-1} className="text-h3 outline-none">
          Your request reached the Guild.
        </h3>
        <p className="text-ash mt-5 font-sans text-[0.9rem] tracking-[0.06em] uppercase">
          Reference number
        </p>
        <p className="mt-1 font-serif text-[2rem] leading-none">{done.ref}</p>
        <div className="mt-6 flex max-w-[60ch] flex-col gap-3 leading-relaxed">
          <p>
            We sent a confirmation to {v.email.trim()}. Keep your reference number in case you need
            to reach us.
          </p>
          {done.filesFailed > 0 && (
            <p className="text-brick font-sans font-semibold">
              {done.filesFailed === 1 ? 'One file' : `${done.filesFailed} files`} did not save. An
              officer may ask you to email {done.filesFailed === 1 ? 'it' : 'them'}.
            </p>
          )}
          <h4 className="mt-2 font-sans font-semibold">What happens next</h4>
          <ol className="flex list-decimal flex-col gap-2 pl-6">
            <li>
              A Guild officer reads your request and may call or email you with questions, or to
              verify what you wrote.
            </li>
            <li>
              If it is a project, we ask tradesmen we know are open to charity work whether one
              would take it on for free. If not, we ask for discounted work.
            </li>
            <li>We decide what financial relief, if any, the Guild can give, and let you know.</li>
          </ol>
          <p className="text-ash font-sans text-[0.95rem]">
            Our funds are limited, and every request is reviewed case by case. We will be honest
            with you either way.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-8">
      <RadioGroup
        name={`${P}-applicantType`}
        legend="Who is asking for help?"
        options={APPLICANT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        value={type}
        onChange={(x) => set('applicantType', x as AidAnswers['applicantType'])}
        error={errors.applicantType}
      />

      {type && (
        <>
          <Group title={org ? 'About the organization' : 'About you'}>
            {org && (
              <TextInput
                id={fid('orgName')}
                label={ORG_NAME_LABEL[type]}
                value={v.orgName}
                onChange={(e) => set('orgName', e.target.value)}
                error={errors.orgName}
                autoComplete="organization"
              />
            )}
            <TextInput
              id={fid('contactName')}
              label={org ? 'Contact person' : 'Your name'}
              value={v.contactName}
              onChange={(e) => set('contactName', e.target.value)}
              error={errors.contactName}
              autoComplete="name"
            />
            <div className="grid gap-6 md:grid-cols-2">
              <TextInput
                id={fid('email')}
                label="Email"
                type="email"
                inputMode="email"
                value={v.email}
                onChange={(e) => set('email', e.target.value)}
                error={errors.email}
                autoComplete="email"
              />
              <TextInput
                id={fid('phone')}
                label="Phone"
                type="tel"
                inputMode="tel"
                value={v.phone}
                onChange={(e) => set('phone', e.target.value)}
                error={errors.phone}
                autoComplete="tel"
              />
            </div>
            <Select
              id={fid('contactPref')}
              label="Best way to reach you"
              optional
              value={v.contactPref}
              onChange={(e) => set('contactPref', e.target.value)}
            >
              <option value="">No preference</option>
              {CONTACT_PREF_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
            <TextInput
              id={fid('address')}
              label="Street address, or at least city and ZIP"
              value={v.address}
              onChange={(e) => set('address', e.target.value)}
              error={errors.address}
              autoComplete="street-address"
            />
            {type !== 'parish' && (
              <TextInput
                id={fid('parish')}
                label={org ? 'Parish' : 'Your parish'}
                optional={!personal}
                hint={personal ? 'If you do not belong to a parish, say so.' : undefined}
                value={v.parish}
                onChange={(e) => set('parish', e.target.value)}
                error={errors.parish}
              />
            )}
          </Group>

          {personal && (
            <Group
              title={type === 'tradesman-medical' ? 'About him and the family' : 'Your household'}
            >
              <TextInput
                id={fid('householdSize')}
                label="How many people live in the household?"
                inputMode="numeric"
                className="border-charcoal bg-paper aria-[invalid=true]:border-brick w-32 border-2 px-4 py-3 font-sans text-[1.0625rem]"
                value={v.householdSize}
                onChange={(e) => set('householdSize', e.target.value)}
                error={errors.householdSize}
              />
              {type === 'tradesman-medical' && (
                <>
                  <TextInput
                    id={fid('trade')}
                    label="His trade"
                    value={v.trade}
                    onChange={(e) => set('trade', e.target.value)}
                    error={errors.trade}
                  />
                  <TextArea
                    id={fid('medicalNature')}
                    label="What is the medical emergency?"
                    hint="Only what you are comfortable sharing."
                    value={v.medicalNature}
                    onChange={(e) => set('medicalNature', e.target.value)}
                    error={errors.medicalNature}
                  />
                  <TextArea
                    id={fid('insurance')}
                    label="What is his health insurance situation?"
                    hint="For example: none, a high deductible, or coverage that has run out."
                    value={v.insurance}
                    onChange={(e) => set('insurance', e.target.value)}
                    error={errors.insurance}
                  />
                  <TextInput
                    id={fid('monthlyShortfall')}
                    label="About how much will the family fall short each month?"
                    optional
                    hint="A rough figure is fine."
                    value={v.monthlyShortfall}
                    onChange={(e) => set('monthlyShortfall', e.target.value)}
                  />
                </>
              )}
              <TextArea
                id={fid('faithImpact')}
                label={FAITH_IMPACT_LABEL}
                hint="We take this seriously."
                value={v.faithImpact}
                onChange={(e) => set('faithImpact', e.target.value)}
                error={errors.faithImpact}
              />
            </Group>
          )}

          {type === 'school' && (
            <Group title="About the school">
              <TextArea
                id={fid('schoolFormation')}
                label="How does your school further Catholic formation?"
                value={v.schoolFormation}
                onChange={(e) => set('schoolFormation', e.target.value)}
                error={errors.schoolFormation}
              />
              <RadioGroup
                name={`${P}-teachersCatholic`}
                legend="Are all of your teachers practising Catholics in good standing with the Church?"
                options={TEACHERS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={v.teachersCatholic}
                onChange={(x) => set('teachersCatholic', x)}
                error={errors.teachersCatholic}
              />
              {v.teachersCatholic && v.teachersCatholic !== 'yes' && (
                <TextArea
                  id={fid('teachersExplain')}
                  label="Tell us more about your teachers"
                  value={v.teachersExplain}
                  onChange={(e) => set('teachersExplain', e.target.value)}
                  error={errors.teachersExplain}
                />
              )}
              <TextArea
                id={fid('studentImpact')}
                label="How would this need, left unmet, affect your students' spiritual formation?"
                value={v.studentImpact}
                onChange={(e) => set('studentImpact', e.target.value)}
                error={errors.studentImpact}
              />
            </Group>
          )}

          {(type === 'parish' || type === 'religious-house') && (
            <Group title={type === 'parish' ? 'About the parish' : 'About the community'}>
              <TextArea
                id={fid('community')}
                label={
                  type === 'parish'
                    ? 'Tell us about the parish community and its ministries'
                    : 'Tell us about the community or ministry'
                }
                value={v.community}
                onChange={(e) => set('community', e.target.value)}
                error={errors.community}
              />
              <TextInput
                id={fid('diocese')}
                label="Diocese"
                value={v.diocese}
                onChange={(e) => set('diocese', e.target.value)}
                error={errors.diocese}
              />
            </Group>
          )}

          {(type === 'business' || type === 'organization') && (
            <Group title="Mission and values">
              <TextArea
                id={fid('mission')}
                label="Describe your mission and how it shares the Guild's values"
                value={v.mission}
                onChange={(e) => set('mission', e.target.value)}
                error={errors.mission}
              />
              <Checkbox
                id={fid('attestValues')}
                checked={v.attestValues}
                onChange={(x) => set('attestValues', x)}
                error={errors.attestValues}
              >
                Our organization does not promote, or take part in, anything that conflicts with the
                teaching of the Catholic Church.
              </Checkbox>
            </Group>
          )}

          <Group title="The need">
            <TextArea
              id={fid('need')}
              label="Describe the need"
              hint="What is wrong, what it is costing you, and anything we should know."
              value={v.need}
              onChange={(e) => set('need', e.target.value)}
              error={errors.need}
            />
            <Select
              id={fid('urgency')}
              label="How urgent is it?"
              value={v.urgency}
              onChange={(e) => set('urgency', e.target.value as AidAnswers['urgency'])}
              error={errors.urgency}
            >
              <option value="">Choose one</option>
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <fieldset className="flex flex-col gap-3">
              <legend className="font-sans text-[1.0625rem] leading-snug font-semibold">
                What kind of help would make the difference?
                <span className="text-ash ml-2 font-normal">(optional, choose any)</span>
              </legend>
              {HELP_KIND_OPTIONS.map((o) => (
                <Checkbox
                  key={o.value}
                  id={`${P}-helpKinds-${o.value}`}
                  checked={v.helpKinds.includes(o.value)}
                  onChange={(on) => toggleHelp(o.value, on)}
                >
                  {o.label}
                </Checkbox>
              ))}
            </fieldset>
            <TextInput
              id={fid('estimatedCost')}
              label="Estimated cost, if you know it"
              optional
              value={v.estimatedCost}
              onChange={(e) => set('estimatedCost', e.target.value)}
            />
            <TextArea
              id={fid('otherHelp')}
              label="Have you asked anyone else for help?"
              optional
              hint="Another charity, your parish, family. It helps us not to duplicate."
              className="border-charcoal bg-paper min-h-[6rem] w-full resize-y border-2 px-4 py-3 font-sans text-[1.0625rem] leading-relaxed"
              value={v.otherHelp}
              onChange={(e) => set('otherHelp', e.target.value)}
            />
          </Group>

          <Group title="Supporting documents">
            <div className="flex flex-col gap-2">
              <label htmlFor={fid('files')} className="font-sans text-[1.0625rem] font-semibold">
                Add files
                <span className="text-ash ml-2 font-normal">(optional)</span>
              </label>
              <p
                id={`${fid('files')}-hint`}
                className="text-ash font-sans text-[0.95rem] leading-snug"
              >
                Bids, bills, or photos of the problem. Up to {AID_MAX_FILES} files, PDF or photos,
                10 MB each.
              </p>
              <input
                ref={fileInput}
                id={fid('files')}
                type="file"
                multiple
                accept={ACCEPT}
                disabled={files.length >= AID_MAX_FILES}
                onChange={(e) => addFiles(e.target.files)}
                aria-invalid={errors.files ? true : undefined}
                aria-describedby={
                  [`${fid('files')}-hint`, errors.files ? `${fid('files')}-error` : '']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                className="file:border-charcoal file:bg-paper font-sans file:mr-4 file:border-2 file:px-4 file:py-2 file:font-semibold"
              />
              {errors.files && (
                <p
                  id={`${fid('files')}-error`}
                  role="alert"
                  className="text-brick font-sans text-[0.95rem] leading-snug font-semibold"
                >
                  {errors.files}
                </p>
              )}
              {files.length > 0 && (
                <ul className="border-mortar mt-2 border-t font-sans">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="border-mortar flex items-center justify-between gap-4 border-b py-2"
                    >
                      <span className="min-w-0 truncate">
                        {f.name} <span className="text-ash">({mb(f.size)})</span>
                      </span>
                      <button
                        type="button"
                        className="decoration-brass shrink-0 font-medium underline decoration-2 underline-offset-4"
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      >
                        Remove<span className="sr-only"> {f.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Group>

          <Group title="Before you send">
            <Checkbox
              id={fid('affirmTruth')}
              checked={v.affirmTruth}
              onChange={(x) => set('affirmTruth', x)}
              error={errors.affirmTruth}
            >
              Everything I have written is true to the best of my knowledge, and I understand the
              Guild may contact me to verify it.
            </Checkbox>
            <p className="text-ash max-w-[60ch] font-sans text-[0.95rem] leading-relaxed">
              We use what you write only to review your request. It stays private, is read only by
              Guild officers, and is never sold or shared for any other purpose.
            </p>
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
            <div className="flex flex-wrap items-center gap-4">
              <PrimaryButton pending={pending}>Send my request</PrimaryButton>
              {pending && <FormStatus>Sending. Files can take a moment.</FormStatus>}
            </div>
          </Group>
        </>
      )}
    </form>
  );
}
