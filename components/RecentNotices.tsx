"use client";

import type { SavedNotice } from "@/lib/types";

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(parsed.getTime())) return "No date";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface Props {
  items: SavedNotice[];
  onOpen: (item: SavedNotice) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export default function RecentNotices({ items, onOpen, onDelete, onClear }: Props) {
  return (
    <section aria-labelledby="recent-heading" className="no-print mt-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="recent-heading" className="font-serif text-2xl font-semibold text-ink">
          Recent Notices
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-[44px] rounded-md border border-line bg-white px-4 text-sm font-medium text-ink hover:border-red-400 hover:text-red-800"
          >
            Clear History
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-white px-4 py-6 text-sm text-muted">
          Notices you generate are saved in this browser only, so you can open them again later. Nothing is sent to a
          database.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate font-semibold text-ink" dir="auto">
                  {item.title}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span>{formatDate(item.date)}</span>
                  <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-dark">
                    {item.noticeType}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  aria-label={`Open notice: ${item.title}`}
                  className="min-h-[44px] rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete notice: ${item.title}`}
                  className="min-h-[44px] rounded-md border border-line bg-white px-4 text-sm font-medium text-ink hover:border-red-400 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
