"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NoticeForm from "./NoticeForm";
import NoticePreview from "./NoticePreview";
import RecentNotices from "./RecentNotices";
import Toast, { type ToastMessage } from "./Toast";
import { formatHeaderDate, generateNotice, hasPlaceholders } from "@/lib/generator";
import { downloadNoticePdf } from "@/lib/pdf";
import { addToHistory, clearHistory, loadHistory, removeFromHistory, STORAGE_ERROR_MESSAGE } from "@/lib/storage";
import { ERROR_MESSAGES, type FormState, type NoticeDraft, type SavedNotice } from "@/lib/types";

const INITIAL_FORM: FormState = {
  instructions: "",
  schoolName: "",
  noticeTitle: "",
  date: "",
  noticeNumber: "",
  issuedBy: "Principal",
  noticeType: "General Announcement",
  audience: "Parents and Students",
};

function todayLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function noticeAsText(draft: NoticeDraft): string {
  const lines = [
    draft.schoolName.trim(),
    "NOTICE",
    draft.noticeNumber.trim() ? `Notice No.: ${draft.noticeNumber.trim()}` : "",
    draft.date ? `Date: ${formatHeaderDate(draft.date)}` : "",
    "",
    draft.title.trim(),
    "",
    draft.notice.trim(),
    "",
    `Issued by: ${draft.issuedBy}`,
  ];
  return lines.filter((line, index) => line !== "" || lines[index - 1] !== "").join("\n").trim();
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function NoticeGenerator() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [draft, setDraft] = useState<NoticeDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [history, setHistory] = useState<SavedNotice[]>([]);
  const [edited, setEdited] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const sheetAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setForm((current) => ({ ...current, date: todayLocal() }));
    const loaded = loadHistory();
    setHistory(loaded.items);
    if (!loaded.ok) setToast({ message: STORAGE_ERROR_MESSAGE, kind: "error" });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);
  const patchForm = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const scrollToSheet = () =>
    window.setTimeout(() => sheetAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  /** Builds the notice from the form with the local templates. Nothing is sent anywhere. */
  const build = () => {
    setConfirmReplace(false);
    if (!form.instructions.trim()) {
      setError(ERROR_MESSAGES.EMPTY_INPUT);
      return;
    }
    setError(null);

    try {
      const result = generateNotice(form);
      const next: NoticeDraft = {
        title: result.title,
        notice: result.notice,
        schoolName: form.schoolName.trim(),
        noticeNumber: form.noticeNumber.trim(),
        date: form.date,
        issuedBy: form.issuedBy,
        noticeType: form.noticeType,
      };
      setDraft(next);
      setWarnings(result.warnings);
      setEdited(false);

      const saved = addToHistory(next);
      setHistory(saved.items);
      if (!saved.ok) setToast({ message: STORAGE_ERROR_MESSAGE, kind: "error" });
      scrollToSheet();
    } catch {
      setError("Something went wrong while writing the notice. Please check your instructions and try again.");
    }
  };

  const handleGenerate = () => {
    // Do not silently throw away text the user has already edited.
    if (draft && edited) {
      setConfirmReplace(true);
      return;
    }
    build();
  };

  const handleCopy = async () => {
    if (!draft) return;
    const ok = await copyText(noticeAsText(draft));
    setToast(
      ok
        ? { message: "Notice copied successfully.", kind: "success" }
        : { message: "We couldn't copy the notice. Please select the text and copy it manually.", kind: "error" }
    );
  };

  const handleDownload = () => {
    if (!draft) return;
    try {
      const unsupported = downloadNoticePdf(draft);
      if (unsupported > 0) {
        setToast({
          message:
            "PDF downloaded, but some characters (for example Urdu script) cannot be shown in the PDF and appear as ?. Please write the notice in English.",
          kind: "error",
        });
      } else if (hasPlaceholders(draft.notice) || hasPlaceholders(draft.title)) {
        setToast({
          message: "PDF downloaded. It still has [placeholders] in square brackets. Edit them and download again.",
          kind: "error",
        });
      } else {
        setToast({ message: "PDF downloaded.", kind: "success" });
      }
    } catch {
      setToast({ message: "We couldn't create the PDF. Please try again.", kind: "error" });
    }
  };

  const handleClear = () => {
    setDraft(null);
    setWarnings([]);
    setError(null);
    setEdited(false);
    setConfirmReplace(false);
  };

  const handleOpen = (item: SavedNotice) => {
    const { id: _id, createdAt: _createdAt, ...rest } = item;
    setDraft(rest);
    setWarnings([]);
    setEdited(false);
    setError(null);
    setConfirmReplace(false);
    scrollToSheet();
  };

  const handleDelete = (id: string) => {
    const result = removeFromHistory(id);
    setHistory(result.items);
    if (!result.ok) setToast({ message: STORAGE_ERROR_MESSAGE, kind: "error" });
  };

  const handleClearHistory = () => {
    if (!clearHistory()) setToast({ message: STORAGE_ERROR_MESSAGE, kind: "error" });
    setHistory([]);
  };

  const actionClass =
    "inline-flex min-h-[44px] items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section id="create" aria-labelledby="generator-heading" className="scroll-mt-6">
      <h2 id="generator-heading" className="no-print mb-6 font-serif text-3xl font-semibold text-ink">
        Notice generator
      </h2>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="no-print">
          <NoticeForm form={form} onChange={patchForm} onSubmit={handleGenerate} error={error} />
        </div>

        <div ref={sheetAnchor} className="min-w-0 scroll-mt-6">
          {confirmReplace && (
            <div
              role="alertdialog"
              aria-label="Confirm replace"
              className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <span className="flex-1 basis-56">
                You edited this notice. Generating again writes a new notice and replaces your edits.
              </span>
              <button
                type="button"
                onClick={build}
                className="min-h-[40px] rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-dark"
              >
                Replace my edits
              </button>
              <button
                type="button"
                onClick={() => setConfirmReplace(false)}
                className="min-h-[40px] rounded-md border border-line bg-white px-4 font-medium text-ink"
              >
                Keep my edits
              </button>
            </div>
          )}

          {draft ? (
            <div className="space-y-4">
              <div className="no-print flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Download PDF
                </button>
                <button type="button" onClick={handleCopy} className={actionClass}>
                  Copy
                </button>
                <button type="button" onClick={() => window.print()} className={actionClass}>
                  Print
                </button>
                <button type="button" onClick={handleClear} className={actionClass}>
                  Clear
                </button>
              </div>

              {warnings.length > 0 && (
                <div
                  role="status"
                  className="no-print rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                >
                  <p className="font-semibold">Please check before you share</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <NoticePreview
                draft={draft}
                onChange={(patch) => {
                  setDraft((current) => (current ? { ...current, ...patch } : current));
                  setEdited(true);
                }}
              />

              <p className="no-print text-xs text-muted">
                Written with built-in templates and simple rules, not by an AI service. Read it carefully and edit any
                field above before you download or print. The PDF contains exactly what you see here.
              </p>
            </div>
          ) : (
            <div
              className="no-print flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-line bg-white px-6 py-12 text-center"
              aria-live="polite"
            >
              <p className="font-serif text-xl font-semibold text-ink">Your notice will appear here</p>
              <p className="mt-2 max-w-sm text-sm text-muted">
                Write your instructions in simple English or Roman Urdu, choose the notice type and audience, then press
                Generate Notice. You can edit the notice and download it as a PDF.
              </p>
            </div>
          )}
        </div>
      </div>

      <RecentNotices items={history} onOpen={handleOpen} onDelete={handleDelete} onClear={handleClearHistory} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </section>
  );
}
