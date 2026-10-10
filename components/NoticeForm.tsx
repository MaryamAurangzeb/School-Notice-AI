"use client";

import { AUDIENCES, ISSUERS, NOTICE_TYPES, type FormState } from "@/lib/types";

/** Clickable input examples. They only fill the instructions box. */
const EXAMPLES = [
  "Kal school barish ki wajah se band hai.",
  "Parents meeting Friday ko 10 baje hai.",
  "Students ko Monday ko completed homework lana hai.",
  "Final exams next week se start hain.",
  "March ki fees Rs 5000 15 October tak jama karwa den.",
  "School timings badal gayi hain. Naya time 8 se 1 baje hai, Monday se.",
];

interface Props {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  onSubmit: () => void;
  error: string | null;
}

const labelClass = "mb-1.5 block text-sm font-semibold text-ink";
const fieldClass =
  "w-full rounded-md border border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-brand";

export default function NoticeForm({ form, onChange, onSubmit, error }: Props) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
      className="space-y-6 rounded-lg border border-line bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <label htmlFor="instructions" className={labelClass}>
          Instructions <span className="font-normal text-muted">(required)</span>
        </label>
        <textarea
          id="instructions"
          rows={5}
          required
          value={form.instructions}
          onChange={(event) => onChange({ instructions: event.target.value })}
          placeholder={
            "Write your instructions here, in simple English or Roman Urdu...\n\nExample:\nKal school barish ki wajah se band hai."
          }
          className={`${fieldClass} resize-y leading-relaxed`}
          aria-describedby="examples-hint"
        />
        <div className="mt-3">
          <p id="examples-hint" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Quick examples
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onChange({ instructions: example })}
                className="min-h-[40px] rounded-full border border-line bg-paper px-3 py-1.5 text-left text-sm text-ink hover:border-brand hover:bg-brand-soft"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="schoolName" className={labelClass}>
            School name <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="schoolName"
            type="text"
            value={form.schoolName}
            onChange={(event) => onChange({ schoolName: event.target.value })}
            placeholder="Enter school name"
            className={fieldClass}
            autoComplete="organization"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="noticeTitle" className={labelClass}>
            Notice title <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="noticeTitle"
            type="text"
            value={form.noticeTitle}
            onChange={(event) => onChange({ noticeTitle: event.target.value })}
            placeholder="Leave empty to use a standard title"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>
            Date
          </label>
          <input
            id="date"
            type="date"
            value={form.date}
            onChange={(event) => onChange({ date: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="noticeNumber" className={labelClass}>
            Notice number <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="noticeNumber"
            type="text"
            value={form.noticeNumber}
            onChange={(event) => onChange({ noticeNumber: event.target.value })}
            placeholder="NOTICE-2026-001"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="audience" className={labelClass}>
            Audience
          </label>
          <select
            id="audience"
            value={form.audience}
            onChange={(event) => onChange({ audience: event.target.value as FormState["audience"] })}
            className={fieldClass}
          >
            {AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {audience}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="issuedBy" className={labelClass}>
            Issued by
          </label>
          <select
            id="issuedBy"
            value={form.issuedBy}
            onChange={(event) => onChange({ issuedBy: event.target.value as FormState["issuedBy"] })}
            className={fieldClass}
          >
            {ISSUERS.map((issuer) => (
              <option key={issuer} value={issuer}>
                {issuer}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Notice type</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NOTICE_TYPES.map((type) => (
            <label key={type} className="cursor-pointer">
              <input
                type="radio"
                name="noticeType"
                value={type}
                checked={form.noticeType === type}
                onChange={() => onChange({ noticeType: type })}
                className="peer sr-only"
              />
              <span className="flex min-h-[52px] items-center rounded-md border border-line bg-white px-3 py-2 text-sm font-medium leading-snug text-ink transition-colors hover:border-brand peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand-dark peer-checked:ring-1 peer-checked:ring-brand peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
                {type}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-md bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark"
        >
          Generate Notice
        </button>
        <p className="mt-3 text-xs text-muted">
          Uses built-in templates and simple rules in your browser. No AI service, account or API key is needed.
        </p>
        <div aria-live="polite" className="mt-3">
          {error && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900">
              {error}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
