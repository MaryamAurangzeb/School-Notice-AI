"use client";

import { useLayoutEffect, useRef } from "react";
import { ISSUERS, type Issuer, type NoticeDraft } from "@/lib/types";

function AutoGrow({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={value}
      rows={3}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}

interface Props {
  draft: NoticeDraft;
  onChange: (patch: Partial<NoticeDraft>) => void;
}

/** The editable, document-style notice. Every field the user changes here stays as typed. */
export default function NoticePreview({ draft, onChange }: Props) {
  return (
    <article id="notice-sheet" className="sheet" dir="ltr" lang="en" aria-label="Generated school notice (editable)">
      <input
        aria-label="School name"
        type="text"
        value={draft.schoolName}
        onChange={(event) => onChange({ schoolName: event.target.value })}
        placeholder="School name"
        className="sheet-school"
      />

      <p className="sheet-word">NOTICE</p>

      <div className="sheet-meta">
        <label className="sheet-meta-field">
          <span>Notice No.</span>
          <input
            type="text"
            value={draft.noticeNumber}
            onChange={(event) => onChange({ noticeNumber: event.target.value })}
            placeholder="—"
          />
        </label>
        <label className="sheet-meta-field">
          <span>Date</span>
          <input type="date" value={draft.date} onChange={(event) => onChange({ date: event.target.value })} />
        </label>
      </div>

      <hr className="sheet-rule" />

      <input
        aria-label="Notice title"
        type="text"
        value={draft.title}
        onChange={(event) => onChange({ title: event.target.value })}
        className="sheet-title"
      />

      <AutoGrow
        label="Notice text"
        value={draft.notice}
        onChange={(notice) => onChange({ notice })}
        className="sheet-body"
      />

      <div className="sheet-sign">
        <label>
          <span className="sheet-sign-label">Issued by</span>
          <select
            aria-label="Issued by"
            value={draft.issuedBy}
            onChange={(event) => onChange({ issuedBy: event.target.value as Issuer })}
          >
            {ISSUERS.map((issuer) => (
              <option key={issuer} value={issuer}>
                {issuer}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
