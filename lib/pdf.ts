/**
 * Tiny local PDF writer for school notices.
 *
 * It builds an A4 PDF in the browser with the standard Times fonts that every PDF reader has.
 * No library, no server, no external API. Only English / Latin-1 text can be shown; other
 * characters (for example Urdu script) are replaced with "?" and reported back to the caller.
 */
import type { NoticeDraft } from "./types";
import { formatHeaderDate } from "./generator";

type FontKey = "F1" | "F2"; // F1 = Times-Roman, F2 = Times-Bold
type Measure = (text: string, font: FontKey, size: number) => number;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40; // outer border distance
const PAD = 38; // distance between border and text
const LEFT = MARGIN + PAD;
const RIGHT = PAGE_W - MARGIN - PAD;
const TEXT_W = RIGHT - LEFT;

/** Maps typographic characters to the byte used by the PDF's WinAnsi encoding. */
const WIN_ANSI: Record<string, number> = {
  "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "–": 0x96, "—": 0x97,
  "•": 0x95, "…": 0x85, "€": 0x80,
};

function toWinAnsi(text: string, bad: { count: number }): string {
  let out = "";
  for (const ch of text.replace(/\t/g, "    ")) {
    const code = ch.codePointAt(0) ?? 63;
    if (WIN_ANSI[ch] !== undefined) out += String.fromCharCode(WIN_ANSI[ch]);
    else if ((code >= 32 && code <= 126) || (code >= 161 && code <= 255)) out += ch;
    else if (code === 160) out += " ";
    else if (code < 32) out += " ";
    else { out += "?"; bad.count++; }
  }
  return out;
}

const escapePdf = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** Measures text with the browser canvas using Times New Roman (metric-compatible with Times). */
function canvasMeasure(): Measure {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement("canvas").getContext("2d");
  } catch {
    ctx = null;
  }
  return (text, font, size) => {
    if (!ctx) return text.length * size * 0.5;
    ctx.font = `${font === "F2" ? "bold " : ""}${size}px "Times New Roman", Times, "Liberation Serif", serif`;
    return ctx.measureText(text).width * 1.02; // small safety margin so lines never overflow
  };
}

function wrap(text: string, font: FontKey, size: number, maxW: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (measure(test, font, size) <= maxW || !line) {
        line = test;
        // A single very long word: break it by characters.
        while (measure(line, font, size) > maxW && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && measure(line.slice(0, cut), font, size) > maxW) cut--;
          lines.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

interface PageOps { ops: string[] }

const num = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Builds the PDF bytes. `measure` can be replaced in tests; in the browser the default is used.
 * Returns the bytes and how many characters could not be shown.
 */
export function buildNoticePdf(draft: NoticeDraft, measure: Measure = canvasMeasure()): { bytes: Uint8Array; unsupported: number } {
  const bad = { count: 0 };
  const T = (s: string) => toWinAnsi(s, bad);
  const pages: PageOps[] = [];
  let page: PageOps;
  let y = 0;

  const text = (s: string, x: number, yy: number, font: FontKey, size: number) =>
    page.ops.push(`BT /${font} ${size} Tf ${num(x)} ${num(yy)} Td (${escapePdf(s)}) Tj ET`);
  const centered = (s: string, yy: number, font: FontKey, size: number) =>
    text(s, (PAGE_W - measure(s, font, size)) / 2, yy, font, size);
  const line = (x1: number, y1: number, x2: number, y2: number, w: number) =>
    page.ops.push(`${num(w)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);

  const newPage = () => {
    page = { ops: [] };
    pages.push(page);
    // Double border, like a printed school notice.
    page.ops.push(`1.2 w ${num(MARGIN)} ${num(MARGIN)} ${num(PAGE_W - 2 * MARGIN)} ${num(PAGE_H - 2 * MARGIN)} re S`);
    page.ops.push(`0.5 w ${num(MARGIN + 5)} ${num(MARGIN + 5)} ${num(PAGE_W - 2 * MARGIN - 10)} ${num(PAGE_H - 2 * MARGIN - 10)} re S`);
    y = PAGE_H - MARGIN - PAD - 6;
  };
  newPage();

  // School name
  const school = T(draft.schoolName.trim());
  if (school) {
    for (const l of wrap(school, "F2", 20, TEXT_W, measure)) {
      centered(l, y - 16, "F2", 20);
      y -= 26;
    }
  } else {
    y -= 6;
  }

  // NOTICE heading with letter spacing
  y -= 10;
  const heading = "N O T I C E";
  centered(heading, y, "F2", 14);
  y -= 30;

  // Notice number and date
  const number = T(draft.noticeNumber.trim());
  const dateText = draft.date ? formatHeaderDate(draft.date) : "";
  if (number) text(`Notice No.: ${number}`, LEFT, y, "F1", 11);
  if (dateText) {
    const d = `Date: ${T(dateText)}`;
    text(d, RIGHT - measure(d, "F1", 11), y, "F1", 11);
  }
  y -= 10;
  line(LEFT, y, RIGHT, y, 1);
  y -= 34;

  // Title (bold, centered, underlined)
  const titleLines = wrap(T(draft.title.trim()), "F2", 15, TEXT_W, measure);
  for (const l of titleLines) {
    centered(l, y, "F2", 15);
    const w = measure(l, "F2", 15);
    line((PAGE_W - w) / 2, y - 3, (PAGE_W + w) / 2, y - 3, 0.8);
    y -= 22;
  }
  y -= 14;

  // Body
  const BODY = 12.5;
  const LEAD = 20;
  const body = wrap(T(draft.notice.trim()), "F1", BODY, TEXT_W, measure);
  const floor = MARGIN + PAD + 90; // keep room for the signature block on the last page
  for (const l of body) {
    if (y < floor) newPage();
    if (l) text(l, LEFT, y, "F1", BODY);
    y -= l ? LEAD : LEAD * 0.55;
  }

  // Signature block (right side)
  y -= 36;
  if (y < MARGIN + PAD + 40) { newPage(); y -= 10; }
  const issuer = T(draft.issuedBy);
  const sigW = Math.max(150, measure(issuer, "F2", 12.5) + 20);
  const sx2 = RIGHT;
  const sx1 = RIGHT - sigW;
  line(sx1, y, sx2, y, 0.8);
  text(issuer, sx1 + (sigW - measure(issuer, "F2", 12.5)) / 2, y - 16, "F2", 12.5);

  return { bytes: assemble(pages), unsupported: bad.count };
}

/** Joins the pages into a valid PDF file. All text is Latin-1, so string length equals byte length. */
function assemble(pages: PageOps[]): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => { objs.push(body); return objs.length; };

  const catalog = add("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObj = add(""); // filled below
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>"); // 3
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>"); // 4
  void catalog;

  const kids: number[] = [];
  for (const p of pages) {
    const stream = p.ops.join("\n");
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageNo = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${content} 0 R >>`,
    );
    kids.push(pageNo);
  }
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let out = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

/** File name such as "school-closure-notice.pdf". */
export function pdfFileName(draft: NoticeDraft): string {
  const base = (draft.title || "notice")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "notice"}.pdf`;
}

/** Creates the PDF in the browser and starts the download. Returns the number of characters that could not be shown. */
export function downloadNoticePdf(draft: NoticeDraft): number {
  const { bytes, unsupported } = buildNoticePdf(draft);
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = pdfFileName(draft);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return unsupported;
}
