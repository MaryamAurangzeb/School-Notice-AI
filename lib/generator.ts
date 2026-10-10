/**
 * Template-based school notice generator.
 *
 * This is NOT generative AI. It reads the instructions with simple rules (keywords, dates, times,
 * amounts, Roman Urdu words) and fills in fixed English templates. It runs completely in the
 * browser, calls no server and needs no API key.
 *
 * Rule: never invent facts. If something is missing, the template shows a placeholder such as
 * [date] and the user fills it in.
 */
import type { Audience, FormState, GeneratedNotice, NoticeType } from "./types";

/* ------------------------------------------------------------------ */
/* Word lists                                                          */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5,
  june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS: Record<string, string> = {
  monday: "Monday", peer: "Monday", pir: "Monday", somwar: "Monday", somwaar: "Monday",
  tuesday: "Tuesday", mangal: "Tuesday", mangalwar: "Tuesday",
  wednesday: "Wednesday", budh: "Wednesday", budhwar: "Wednesday",
  thursday: "Thursday", jumeraat: "Thursday", jumerat: "Thursday", jumaraat: "Thursday", jumayrat: "Thursday",
  friday: "Friday", juma: "Friday", jumma: "Friday", jumah: "Friday",
  saturday: "Saturday", sanichar: "Saturday", hafta: "Saturday",
  sunday: "Sunday", itwar: "Sunday", itwaar: "Sunday", ittwar: "Sunday",
};
// "hafta" means "week" in Roman Urdu, so it is not treated as Saturday.
delete WEEKDAYS.hafta;
const WEEKDAY_RE = Object.keys(WEEKDAYS).join("|");

/** Common Roman Urdu words. Used only to guess whether a sentence is Roman Urdu. */
const ROMAN_WORDS = new Set(
  ("hai hain ho hoga hogi hongay hongi tha thi the ka ki ke ko se mein me main par pe aur ya nahi nahin kal aaj parson " +
    "wajah liye lye kiya karen karein kren krein karna lana laana lain layen bachay bachon bache bachay tamam sab tak baad " +
    "pehle pahle shuru shuroo band khulega khulay khulayga rahega rahay rahegi ga gi gay gey jayen jaye jayein den dein dena " +
    "karwa karwana jama chutti chhutti imtihan imtihanat waldain walid walida ustad asatza zaroori lazmi bhi yeh ye woh wo " +
    "is us in un apne apna apni hamare humara agle aglay agli hafte haftay mahine sath saath jald jaldi koi kuch ab abhi " +
    "barish baarish garmi sardi ghar wapas dobara tareekh tarikh akhri aakhri ghair hazir haazir hazri fees fee wajah").split(" "),
);

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const endSentence = (s: string) => {
  const t = clean(s).replace(/[\s,;:]+$/, "");
  return /[.!?]$/.test(t) ? t : `${t}.`;
};
const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDay(d: number, m: number, y?: number): string {
  return `${d} ${MONTH_NAMES[m - 1]}${y ? ` ${y}` : ""}`;
}

function fullYear(y: string | undefined): number | undefined {
  if (!y) return undefined;
  const n = parseInt(y, 10);
  if (y.length === 2) return 2000 + n;
  return n;
}

function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function describeDate(d: Date): string {
  return `${WEEKDAY_NAMES[d.getUTCDay()]}, ${formatDay(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear())}`;
}

/** Date shown in the notice header, for example "16 October 2026". */
export function formatHeaderDate(iso: string): string {
  const d = parseIsoDate(iso);
  return d ? formatDay(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()) : iso;
}

/* ------------------------------------------------------------------ */
/* Reading facts from the instructions                                 */
/* ------------------------------------------------------------------ */

type Role = "main" | "reopen" | "due";
interface Mention {
  index: number;
  end: number;
  kind: "range" | "date" | "rel" | "weekday";
  text: string;
  role: Role;
  weekday?: string;
  /** Prefix such as "on" or "from"; empty when the text already reads naturally. */
  prep: string;
  /** Number of days after the notice date, for today/tomorrow/day after tomorrow. */
  offset?: number;
}

interface Facts {
  mentions: Mention[];
  time: string | null;
  timeRange: string | null;
  amount: string | null;
  classes: string | null;
  venue: string | null;
  percent: string | null;
}

class Tracker {
  private used: boolean[];
  constructor(length: number) { this.used = new Array(length).fill(false); }
  free(start: number, end: number): boolean {
    for (let i = start; i < end; i++) if (this.used[i]) return false;
    return true;
  }
  claim(start: number, end: number) { for (let i = start; i < end; i++) this.used[i] = true; }
}

const REOPEN_RE = /(re-?open|resume|open again|start again|khul|wapas|dobara|dubara)/;
const DUE_RE = /(last date|due date|due|deadline|akhri|aakhri|by |before|until|till)/;

function roleFor(lower: string, index: number, end: number, kind: Mention["kind"]): Role {
  // Only look inside the same sentence, so "tak band hai. School 16 June ko khulega." is not mixed up.
  let start = index;
  while (start > 0 && !/[.!?;\n]/.test(lower.charAt(start - 1))) start--;
  let stop = end;
  while (stop < lower.length && !/[.!?;\n]/.test(lower.charAt(stop))) stop++;
  const around = lower.slice(start, stop);
  const before = lower.slice(Math.max(start, index - 22), index);
  const after = lower.slice(end, Math.min(stop, end + 24));
  if (REOPEN_RE.test(around)) return "reopen";
  if (kind === "range") return "main";
  if (DUE_RE.test(before) || /^\s*(tak|ke andar|se pehle)/.test(after) || /last date|due date|akhri|aakhri/.test(around)) return "due";
  return "main";
}

function to24(h: number, period: string | undefined, warnings: string[]): { h: number; p: "AM" | "PM" } {
  if (period === "am") return { h: h === 12 ? 12 : h, p: "AM" };
  if (period === "pm") return { h: h === 12 ? 12 : h, p: "PM" };
  if (h > 12) return { h: h - 12, p: "PM" };
  // No AM/PM written. School notices usually mean 7-11 morning and 12-6 afternoon.
  const p = h >= 7 && h <= 11 ? "AM" : "PM";
  const msg = "AM/PM was not written for the time. Please check that it is correct.";
  if (!warnings.includes(msg)) warnings.push(msg);
  return { h, p };
}

function fmtTime(h: number, m: number, period: string | undefined, warnings: string[]): string {
  const t = to24(h, period, warnings);
  return `${t.h}:${pad2(m)} ${t.p}`;
}

function periodNear(lower: string, end: number): string | undefined {
  const after = lower.slice(end, end + 22);
  if (/(subah|subha|morning)/.test(after)) return "am";
  if (/(dopahar|dophar|afternoon|shaam|sham|evening|raat|night)/.test(after)) return "pm";
  return undefined;
}

function readFacts(raw: string, noticeDate: Date | null, warnings: string[]): Facts {
  const lower = raw.toLowerCase();
  const track = new Tracker(lower.length);
  const mentions: Mention[] = [];
  let m: RegExpExecArray | null;

  // 1. Date ranges: "10 to 15 October", "10 October se 15 October tak"
  const rangeRe = new RegExp(
    `(\\d{1,2})(?:st|nd|rd|th)?\\s*(${MONTH_RE})?\\s*(?:to|se|till|tak|until|-|–)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(${MONTH_RE})\\b(?:\\s*,?\\s*(\\d{4}))?`,
    "g",
  );
  while ((m = rangeRe.exec(lower))) {
    const end = m.index + m[0].length;
    if (!track.free(m.index, end)) continue;
    const d1 = +m[1], d2 = +m[3];
    const m2 = MONTHS[m[4]];
    const m1 = m[2] ? MONTHS[m[2]] : m2;
    const y = fullYear(m[5]);
    if (d1 < 1 || d1 > 31 || d2 < 1 || d2 > 31) continue;
    const text = m[2] ? `${formatDay(d1, m1)} to ${formatDay(d2, m2, y)}` : `${d1} to ${formatDay(d2, m2, y)}`;
    track.claim(m.index, end);
    mentions.push({ index: m.index, end, kind: "range", text, role: "main", prep: "from" });
  }

  // 2. Single dates: "15 October", "October 15th", "15/10/2026"
  const dateRes: Array<[RegExp, (x: RegExpExecArray) => string | null]> = [
    [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b(?:\\s*,?\\s*(\\d{4}))?`, "g"),
      (x) => (+x[1] >= 1 && +x[1] <= 31 ? formatDay(+x[1], MONTHS[x[2]], fullYear(x[3])) : null)],
    [new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4}))?`, "g"),
      (x) => (+x[2] >= 1 && +x[2] <= 31 ? formatDay(+x[2], MONTHS[x[1]], fullYear(x[3])) : null)],
    [/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g,
      (x) => (+x[1] >= 1 && +x[1] <= 31 && +x[2] >= 1 && +x[2] <= 12 ? formatDay(+x[1], +x[2], fullYear(x[3])) : null)],
  ];
  for (const [re, build] of dateRes) {
    while ((m = re.exec(lower))) {
      const end = m.index + m[0].length;
      if (!track.free(m.index, end)) continue;
      const text = build(m);
      if (!text) continue;
      track.claim(m.index, end);
      mentions.push({ index: m.index, end, kind: "date", text, role: "main", prep: "on" });
    }
  }
  if (/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/.test(lower)) {
    warnings.push("Numeric dates such as 15/10/2026 were read as day/month/year. Please check them.");
  }

  // 3. Relative days: today, tomorrow, day after tomorrow, next week...
  const relRes: Array<[RegExp, string, number | undefined]> = [
    [/\b(day after tomorrow|parson|parsoon|parso)\b/g, "the day after tomorrow", 2],
    [/\b(tomorrow|kal|kl)\b/g, "tomorrow", 1],
    [/\b(today|aaj|aj)\b/g, "today", 0],
    [/\b(next week|agle hafte|aglay hafte|agle haftay|aglay haftay|agle hafta)\b/g, "next week", undefined],
    [/\b(this week|is hafte|is haftay)\b/g, "this week", undefined],
    [/\b(next month|agle mahine|aglay mahine|agle maheenay)\b/g, "next month", undefined],
  ];
  for (const [re, label, offset] of relRes) {
    while ((m = re.exec(lower))) {
      const end = m.index + m[0].length;
      if (!track.free(m.index, end)) continue;
      track.claim(m.index, end);
      const fromWord = /from\s*$/.test(lower.slice(Math.max(0, m.index - 6), m.index)) || /^\s*se\b/.test(lower.slice(end, end + 5));
      let text = label;
      if (offset !== undefined && noticeDate) text = `${label} (${describeDate(addDays(noticeDate, offset))})`;
      mentions.push({
        index: m.index, end, kind: "rel", text, role: "main",
        prep: fromWord && offset !== undefined ? "from" : "", offset,
      });
    }
  }
  if (/\b(kal|kl)\b/.test(lower)) {
    warnings.push('"Kal" can mean tomorrow or yesterday in Roman Urdu. It was read as tomorrow. Please check.');
  }

  // 4. Weekdays: "Friday", "next Monday", "juma"
  const wdRe = new RegExp(`\\b(next |agle |aglay |coming )?(${WEEKDAY_RE})\\b`, "g");
  while ((m = wdRe.exec(lower))) {
    const end = m.index + m[0].length;
    if (!track.free(m.index, end)) continue;
    track.claim(m.index, end);
    const day = WEEKDAYS[m[2]];
    mentions.push({
      index: m.index, end, kind: "weekday", weekday: day, role: "main",
      text: m[1] ? `next ${day}` : day, prep: m[1] ? "" : "on",
    });
  }

  for (const x of mentions) x.role = roleFor(lower, x.index, x.end, x.kind);
  mentions.sort((a, b) => a.index - b.index);

  // 5. Class names: "class 5", "grade 8", "9th class", "class 1 to 5"
  let classes: string | null = null;
  const classRe1 = /\b(?:class|classes|grade|grades)\s*(?:no\.?\s*)?(\d{1,2})(?:\s*(?:to|se|-|–|tak|till)\s*(\d{1,2}))?\b/g;
  const classRe2 = /\b(\d{1,2})(?:st|nd|rd|th)\s*(?:class|grade)\b/g;
  while ((m = classRe1.exec(lower))) {
    const end = m.index + m[0].length;
    if (!track.free(m.index, end)) continue;
    track.claim(m.index, end);
    if (!classes) classes = m[2] ? `Classes ${m[1]} to ${m[2]}` : `Class ${m[1]}`;
  }
  while ((m = classRe2.exec(lower))) {
    const end = m.index + m[0].length;
    if (!track.free(m.index, end)) continue;
    track.claim(m.index, end);
    if (!classes) classes = `Class ${m[1]}`;
  }

  // 6. Amounts: "Rs 5000", "5,000 rupay"
  let amount: string | null = null;
  const amountRes = [
    /\b(?:rs|pkr|rupees?|rupay|rupaye|rupe)\.?\s*([\d,]{2,})\b/g,
    /\b([\d,]{2,})\s*(?:rs|pkr|rupees?|rupay|rupaye|rupe)\b/g,
    /\bfees?\s+(?:of\s+|ki\s+)?([\d,]{3,})\b/g,
  ];
  for (const re of amountRes) {
    while ((m = re.exec(lower))) {
      const end = m.index + m[0].length;
      if (!track.free(m.index, end)) continue;
      track.claim(m.index, end);
      if (!amount) {
        const n = parseInt(m[1].replace(/,/g, ""), 10);
        if (!Number.isNaN(n)) amount = `Rs. ${n.toLocaleString("en-US")}`;
      }
    }
  }

  // 7. Percentages
  let percent: string | null = null;
  const pct = /\b(\d{1,3})\s*(?:%|percent|pc)/.exec(lower);
  if (pct && track.free(pct.index, pct.index + pct[0].length)) {
    percent = `${pct[1]}%`;
    track.claim(pct.index, pct.index + pct[0].length);
  }

  // 8. Times: "10 baje", "9 am", "8:30", "9 to 12 baje"
  let time: string | null = null;
  let timeRange: string | null = null;
  const unit = "(am|pm|a\\.m\\.|p\\.m\\.|baje|bje|o'clock)";
  const trRe = new RegExp(
    `\\b(\\d{1,2})(?::(\\d{2}))?\\s*${unit}?\\s*(?:to|se|till|tak|until|-|–)\\s*(\\d{1,2})(?::(\\d{2}))?\\s*${unit}?`, "g");
  while ((m = trRe.exec(lower))) {
    const end = m.index + m[0].length;
    if (!track.free(m.index, end)) continue;
    if (!m[3] && !m[6] && !m[2] && !m[5]) continue; // needs "am/pm/baje" or a colon to be a time
    const h1 = +m[1], h2 = +m[4];
    if (h1 > 24 || h2 > 24) continue;
    const p1 = (m[3] || "").replace(/\./g, "");
    const p2 = (m[6] || "").replace(/\./g, "");
    const per2 = /^(am|pm)$/.test(p2) ? p2 : periodNear(lower, end);
    const per1 = /^(am|pm)$/.test(p1) ? p1 : per2 && h1 <= h2 ? per2 : undefined;
    track.claim(m.index, end);
    if (!timeRange) {
      timeRange = `${fmtTime(h1, m[2] ? +m[2] : 0, per1, warnings)} to ${fmtTime(h2, m[5] ? +m[5] : 0, per2, warnings)}`;
    }
  }
  const timeRes: Array<RegExp> = [
    new RegExp(`\\b(\\d{1,2})(?::(\\d{2}))?\\s*${unit}`, "g"),
    /\bat\s+(\d{1,2}):(\d{2})\b/g,
    /\b(\d{1,2}):(\d{2})\b/g,
  ];
  for (const re of timeRes) {
    while ((m = re.exec(lower))) {
      const end = m.index + m[0].length;
      if (!track.free(m.index, end)) continue;
      const h = +m[1];
      if (h > 24) continue;
      track.claim(m.index, end);
      if (time) continue;
      const u = (m[3] || "").replace(/\./g, "");
      const per = /^(am|pm)$/.test(u) ? u : periodNear(lower, end);
      time = fmtTime(h, m[2] ? +m[2] : 0, per, warnings);
    }
  }

  // 9. Venue
  let venue: string | null = null;
  const venueWords = "(?:school\\s+|main\\s+|assembly\\s+|sports\\s+)?(?:hall|auditorium|playground|ground|library|classroom|lab|laboratory|office)";
  const v1 = new RegExp(`\\b(?:in|at)\\s+(?:the\\s+)?(${venueWords})\\b`).exec(lower);
  const v2 = new RegExp(`\\b(${venueWords})\\s+(?:mein|me|main|par|pe)\\b`).exec(lower);
  const vm = v1 || v2;
  if (vm) venue = `the ${vm[1]}`;

  return { mentions, time, timeRange, amount, classes, venue, percent };
}

/* ------------------------------------------------------------------ */
/* Phrases built from the facts                                        */
/* ------------------------------------------------------------------ */

function phraseFor(mentions: Mention[], role: Role, warnings: string[]): string | null {
  const list = mentions.filter((x) => x.role === role);
  if (!list.length) return null;

  const ranges = list.filter((x) => x.kind === "range");
  if (ranges.length) return `from ${ranges[0].text}`;

  const rel = list.find((x) => x.kind === "rel");
  const wds = list.filter((x) => x.kind === "weekday");
  const dates = list.filter((x) => x.kind === "date");

  if (rel) {
    // Check that a written weekday matches "tomorrow" etc.
    const resolvedDay = /\((\w+),/.exec(rel.text);
    if (rel.offset !== undefined && wds.length === 1 && wds[0].weekday && resolvedDay && resolvedDay[1] !== wds[0].weekday) {
      warnings.push(`You wrote ${wds[0].weekday}, but ${rel.text.split(" (")[0]} is ${resolvedDay[1]} according to the notice date. Please check.`);
    }
    return rel.prep === "from" ? `from ${rel.text}` : rel.text;
  }

  if (dates.length === 2) return `on ${dates[0].text} and ${dates[1].text}`;
  if (dates.length >= 1 && wds.length >= 1) return `on ${wds[0].weekday}, ${dates[0].text}`;
  if (dates.length >= 1) return `on ${dates[0].text}`;

  if (wds.length === 2) {
    return `from ${wds[0].weekday} to ${wds[1].weekday}`;
  }
  if (wds.length >= 3) {
    const names = wds.map((w) => w.weekday as string);
    return `on ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  const w = wds[0];
  return w.prep ? `${w.prep} ${w.text}` : w.text;
}

const KEYWORDS = {
  rain: /\b(barish|baarish|barsat|rain|rainy|rainfall)\b/,
  heavy: /\b(heavy|shadeed|shadid|tez|zyada|bohat|bahut)\b/,
  heat: /\b(garmi|heat|hot weather|heatwave|heat wave)\b/,
  cold: /\b(sardi|cold weather|cold wave)\b/,
  fog: /\b(dhund|fog|foggy)\b/,
  smog: /\bsmog\b/,
  flood: /\b(flood|floods|sailab)\b/,
  stayHome: /(stay (?:at )?home|ghar (?:par|pe|mein|me|rahen|rahein|rahain)|ghar rehna)/,
  closed: /(band|closed|close|off)\b/,
  homework: /\b(homework|home work|assignment|assignments|project|worksheet|worksheets|ghar ka kaam)\b/,
  bring: /\b(lana|laana|laayen|layen|bring|le kar|lekar)\b/,
  submit: /\b(submit|jama|hand in)\b/,
  complete: /\b(complete|mukammal|poora|pura|kar ke|karke)\b/,
  ptm: /(parents? ?-? ?teachers? meeting|parents? meeting|\bptm\b|waldain|parent day|parents day)/,
  attendance: /\b(attendance|hazri|haazri|absent|ghair hazir|gair hazir|ghair haazir|late)\b/,
  timing: /\b(timing|timings|school time|school times|time table|timetable|schedule)\b/,
  changed: /\b(change|changed|changes|badal|badla|badli|revised|new|naya|nayi|updated|shift|shifted)\b/,
  exam: /\b(exam|exams|examination|examinations|imtihan|imtihanat|paper|papers|test|tests|datesheet|date sheet)\b/,
  fee: /\b(fee|fees|dues|tuition|fine|jurmana)\b/,
  event: /\b(function|competition|fair|exhibition|trip|picnic|tour|assembly|ceremony|day|milad|debate|quiz|concert|show|walk|rally|party)\b/,
  holiday: /\b(holiday|holidays|chutti|chhutti|chuttiyan|chhuttiyan|vacation|vacations|break|eid|muharram|ashura)\b/,
  discuss: /\b(result|results|progress|report card|report cards|behaviou?r|performance)\b/,
  mustWord: /\b(zaroori|zarori|lazmi|required|minimum|must|compulsory|mandatory)\b/,
};

function reasonPhrase(lower: string): string | null {
  if (KEYWORDS.rain.test(lower)) return KEYWORDS.heavy.test(lower) ? "heavy rain" : "rain";
  if (KEYWORDS.flood.test(lower)) return "flood conditions";
  if (KEYWORDS.smog.test(lower)) return "smog";
  if (KEYWORDS.fog.test(lower)) return "fog";
  if (KEYWORDS.heat.test(lower)) return /(shadeed|shadid|extreme|severe|heatwave|heat wave)/.test(lower) ? "extreme heat" : "hot weather";
  if (KEYWORDS.cold.test(lower)) return "cold weather";
  return null;
}

const OCCASIONS: Array<[RegExp, string]> = [
  [/eid[\s-]*ul[\s-]*fitr|eid[\s-]*al[\s-]*fitr|meethi eid/, "Eid-ul-Fitr"],
  [/eid[\s-]*ul[\s-]*adha|eid[\s-]*al[\s-]*adha|bakra eid|bakrid/, "Eid-ul-Adha"],
  [/\beid\b/, "Eid"],
  [/muharram|ashura|ashoora/, "Muharram"],
  [/independence day|youm[\s-]*e[\s-]*azadi|14 august/, "Independence Day"],
  [/pakistan day|23 march/, "Pakistan Day"],
  [/iqbal day|youm[\s-]*e[\s-]*iqbal/, "Iqbal Day"],
  [/quaid[\s-]*e[\s-]*azam day|quaid day/, "Quaid-e-Azam Day"],
  [/christmas/, "Christmas"],
  [/ramzan|ramadan|ramazan/, "Ramadan"],
  [/\bmilad\b|eid milad|12 rabi/, "Eid Milad-un-Nabi"],
];
const VACATIONS: Array<[RegExp, string]> = [
  [/summer (?:vacation|vacations|break|holidays)|garmi(?:on)? ki chutti/, "Summer vacations"],
  [/winter (?:vacation|vacations|break|holidays)|sardi(?:on)? ki chutti/, "Winter vacations"],
  [/spring (?:vacation|break)/, "Spring break"],
];

function occasionPhrase(lower: string): { occasion: string | null; vacation: string | null } {
  let occasion: string | null = null;
  let vacation: string | null = null;
  for (const [re, label] of OCCASIONS) if (re.test(lower)) { occasion = label; break; }
  for (const [re, label] of VACATIONS) if (re.test(lower)) { vacation = label; break; }
  return { occasion, vacation };
}

function examName(lower: string): string {
  const plural = /\b(exams|examinations|imtihanat|papers|tests)\b/.test(lower) ? "s" : "";
  const kinds: Array<[RegExp, string]> = [
    [/\b(final|annual|salana|saalana)\b/, "Final"],
    [/mid[\s-]*term|midterm/, "Mid-Term"],
    [/half[\s-]*yearly/, "Half-Yearly"],
    [/monthly/, "Monthly"],
    [/weekly/, "Weekly"],
    [/\bunit\b/, "Unit"],
    [/pre[\s-]*board/, "Pre-Board"],
    [/practical/, "Practical"],
    [/\boral\b/, "Oral"],
    [/\bquarterly\b/, "Quarterly"],
    [/\bsend[\s-]*up\b/, "Send-Up"],
  ];
  let kind = "";
  for (const [re, label] of kinds) if (re.test(lower)) { kind = label; break; }
  if (/\b(test|tests)\b/.test(lower) && !/\b(exam|exams|examination|examinations|imtihan|imtihanat)\b/.test(lower)) {
    return `${kind ? `${kind} ` : ""}Test${plural}`;
  }
  return `${kind ? `${kind} ` : ""}Examination${plural}`;
}

function eventName(lower: string): string | null {
  const list: Array<[RegExp, string]> = [
    [/sports day|sports week|khelon ka din/, "Sports Day"],
    [/annual (?:function|day)|salana function/, "Annual Function"],
    [/science (?:fair|exhibition)/, "Science Fair"],
    [/speech competition/, "Speech Competition"],
    [/\bcompetition\b/, "Competition"],
    [/\b(?:educational )?(?:trip|tour)\b/, "Educational Trip"],
    [/\bpicnic\b/, "Picnic"],
    [/prize distribution|inam taqseem/, "Prize Distribution Ceremony"],
    [/result day|result announcement/, "Result Day"],
    [/\bmilad\b|\bnaat\b|\bqirat\b/, "Milad Programme"],
    [/\bdebate\b/, "Debate"],
    [/\bquiz\b/, "Quiz Competition"],
    [/fancy dress/, "Fancy Dress Show"],
    [/\bassembly\b/, "Special Assembly"],
    [/\bexhibition\b/, "Exhibition"],
    [/\bparty\b/, "Party"],
    [/\bceremony\b/, "Ceremony"],
  ];
  for (const [re, label] of list) if (re.test(lower)) return label;
  return null;
}

function feeKind(lower: string): string {
  if (/tuition/.test(lower)) return "tuition fee";
  if (/monthly/.test(lower)) return "monthly fee";
  if (/annual|salana/.test(lower)) return "annual fee";
  if (/admission/.test(lower)) return "admission fee";
  if (/exam/.test(lower)) return "examination fee";
  if (/transport|van|bus/.test(lower)) return "transport fee";
  return "school fee";
}

/* ------------------------------------------------------------------ */
/* Audience wording                                                    */
/* ------------------------------------------------------------------ */

function audienceText(audience: Audience, classes: string | null): string {
  const of = classes ? ` of ${classes}` : "";
  switch (audience) {
    case "Parents and Students": return `all parents and students${of}`;
    case "Parents": return `all parents${classes ? ` of students of ${classes}` : ""}`;
    case "Students": return `all students${of}`;
    case "Teachers and Staff": return "all teachers and staff members";
    default: return "all concerned";
  }
}

/* ------------------------------------------------------------------ */
/* Roman Urdu detection                                                */
/* ------------------------------------------------------------------ */

function romanRatio(sentence: string): number {
  const words = sentence.toLowerCase().match(/[a-z']+/g) || [];
  if (!words.length) return 0;
  let hits = 0;
  for (const w of words) if (ROMAN_WORDS.has(w)) hits++;
  return hits / words.length;
}

const ANY_KNOWN = new RegExp(
  [
    `\\b(${MONTH_RE})\\b`, `\\b(${WEEKDAY_RE})\\b`, "\\b\\d", "\\b(baje|bje|am|pm)\\b",
    "\\b(tomorrow|today|kal|aaj|parson|next week|agle hafte)\\b",
    KEYWORDS.rain.source, KEYWORDS.heat.source, KEYWORDS.cold.source, KEYWORDS.fog.source, KEYWORDS.smog.source,
    KEYWORDS.flood.source, KEYWORDS.stayHome.source, KEYWORDS.homework.source, KEYWORDS.ptm.source,
    KEYWORDS.attendance.source, KEYWORDS.timing.source, KEYWORDS.exam.source, KEYWORDS.fee.source,
    KEYWORDS.holiday.source, "\\b(band|khulega|reopen|resume|closed)\\b", "\\b(shuru|start|begin|khatam|end)\\b",
  ].join("|"),
);

/* ------------------------------------------------------------------ */
/* Notice type guessing (only when "General Announcement" is chosen)   */
/* ------------------------------------------------------------------ */

function guessType(lower: string): NoticeType | null {
  if (KEYWORDS.ptm.test(lower)) return "Parent-Teacher Meeting";
  if (KEYWORDS.fee.test(lower) && (/(rs|rupay|rupees|jama|pay|due|\d{3,})/.test(lower))) return "Fee Reminder";
  if (KEYWORDS.exam.test(lower)) return "Examination";
  if (KEYWORDS.timing.test(lower) && KEYWORDS.changed.test(lower)) return "Timetable Change";
  if (KEYWORDS.homework.test(lower)) return "Homework / Assignment";
  if (/\b(band|closed)\b/.test(lower) && (reasonPhrase(lower) || /school/.test(lower))) return "School Closure";
  if (KEYWORDS.holiday.test(lower)) return "Holiday";
  if (KEYWORDS.attendance.test(lower)) return "Attendance";
  return null;
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

interface Ctx {
  lower: string;
  facts: Facts;
  who: string;
  main: string | null;
  reopen: string | null;
  due: string | null;
  placeholders: string[];
  warnings: string[];
  userTitle: string;
}

function ph(ctx: Ctx, label: string): string {
  const token = `[${label}]`;
  if (!ctx.placeholders.includes(token)) ctx.placeholders.push(token);
  return token;
}

/** "at 10:00 AM" or "from 9:00 AM to 12:00 PM", or "" when no time was given. */
function atTime(ctx: Ctx): string {
  if (ctx.facts.timeRange) return ` from ${ctx.facts.timeRange}`;
  if (ctx.facts.time) return ` at ${ctx.facts.time}`;
  return "";
}

/** " for Class 5", but only when the audience sentence does not already say the class. */
function forClass(ctx: Ctx): string {
  return ctx.facts.classes && !ctx.who.includes(ctx.facts.classes) ? ` for ${ctx.facts.classes}` : "";
}

function atVenue(ctx: Ctx): string {
  return ctx.facts.venue ? ` in ${ctx.facts.venue}` : "";
}

function closureBody(ctx: Ctx, kind: "Holiday" | "School Closure"): { title: string; paras: string[] } {
  const { lower } = ctx;
  const { occasion, vacation } = occasionPhrase(lower);
  const reason = reasonPhrase(lower);
  const when = ctx.main;
  const sentences: string[] = [];

  if (vacation) {
    const start = when ? ` ${when}` : ` ${ph(ctx, "date")}`;
    const verb = /(khatam|end|over)\b/.test(lower) && !/(shuru|start|begin)/.test(lower) ? "will end" : "will begin";
    sentences.push(`This is to inform ${ctx.who} that the ${vacation.toLowerCase()} ${verb}${start}.`);
  } else {
    const why = reason ? `due to ${reason}` : occasion ? `on the occasion of ${occasion}` : "";
    const whenText = when ?? ph(ctx, "date");
    const closed = `the school will remain closed ${whenText}${why ? ` ${why}` : ""}`;
    sentences.push(`This is to inform ${ctx.who} that ${closed}.`);
  }
  if (ctx.reopen) sentences.push(`The school will reopen ${ctx.reopen}.`);
  if (KEYWORDS.stayHome.test(lower)) sentences.push("Students are requested to stay at home.");

  const title = vacation || kind === "Holiday" ? "Holiday Notice" : "School Closure Notice";
  return { title, paras: [sentences.join(" ")] };
}

function examBody(ctx: Ctx): { title: string; paras: string[] } {
  const { lower } = ctx;
  const name = examName(lower);
  const starts = /(shuru|start|starts|begin|begins|commence|commences)/.test(lower);
  const ends = /(khatam|end|ends|finish|conclude|over)\b/.test(lower);
  const when = ctx.main ?? ph(ctx, "date");
  const forWho = forClass(ctx);
  let verb = "will be held";
  if (starts && !ends) verb = "will commence";
  else if (ends && !starts) verb = "will end";
  const sentences = [`This is to inform ${ctx.who} that the ${name}${forWho} ${verb} ${when}${atTime(ctx)}${atVenue(ctx)}.`];
  if (ctx.due) sentences.push(`Please note the date ${ctx.due}.`);
  sentences.push("Students are advised to prepare well.");
  return { title: `${name.replace(/s$/, "")} Notice`, paras: [sentences.join(" ")] };
}

function ptmBody(ctx: Ctx): { title: string; paras: string[] } {
  const { lower } = ctx;
  const when = ctx.main ?? ph(ctx, "date");
  const timeText = atTime(ctx) || ` at ${ph(ctx, "time")}`;
  const topics: string[] = [];
  if (/\bresults?\b/.test(lower)) topics.push("students' results");
  if (/progress/.test(lower)) topics.push("academic progress");
  if (/report card/.test(lower)) topics.push("report cards");
  if (/behaviou?r/.test(lower)) topics.push("behaviour");
  if (/performance/.test(lower)) topics.push("performance");
  const sentences = [`A parent-teacher meeting${forClass(ctx)} will be held ${when}${timeText}${atVenue(ctx)}.`];
  if (topics.length) {
    const list = topics.length === 1 ? topics[0] : `${topics.slice(0, -1).join(", ")} and ${topics[topics.length - 1]}`;
    sentences.push(`The meeting will be about ${list}.`);
  }
  sentences.push("All parents are requested to attend.");
  return { title: "Parent-Teacher Meeting Notice", paras: [sentences.join(" ")] };
}

function feeBody(ctx: Ctx): { title: string; paras: string[] } {
  const { lower, facts } = ctx;
  const kind = feeKind(lower);
  const monthMatch = new RegExp(`\\b(${MONTH_RE})\\s+(?:ki\\s+|ka\\s+|ke\\s+)?(?:fee|fees|dues)\\b`).exec(lower);
  const forMonth = monthMatch ? ` for ${MONTH_NAMES[MONTHS[monthMatch[1]] - 1]}` : "";
  const amount = facts.amount ? ` of ${facts.amount}` : "";
  const due = ctx.due ?? ctx.main ?? ph(ctx, "last date");
  const dueText = /^(on |from |tomorrow|today|next|the day)/.test(due) ? due : `on ${due}`;
  const sentences = [`This is a reminder to ${ctx.who === "all concerned" ? "all concerned" : "all parents"} that the ${kind}${amount}${forMonth} is due.`];
  sentences.push(`Parents are requested to pay the ${kind} on or before ${dueText.replace(/^on /, "")}.`);
  if (/(late fee|jurmana|fine)/.test(lower)) sentences.push("A late fee or fine may apply after the due date.");
  if (!facts.amount) ctx.warnings.push("No fee amount was found, so the amount was left out. Add it if you want it in the notice.");
  return { title: "Fee Reminder Notice", paras: [sentences.join(" ")] };
}

function eventBody(ctx: Ctx): { title: string; paras: string[] } {
  const { lower } = ctx;
  const name = ctx.userTitle || eventName(lower) || ph(ctx, "event name");
  const when = ctx.main ?? ph(ctx, "date");
  const sentences = [`This is to inform ${ctx.who} that the ${name} will be held ${when}${atTime(ctx)}${atVenue(ctx)}.`];
  if (/(attend|aayen|ayen|shirkat|invite)/.test(lower)) sentences.push("All are requested to attend.");
  const found = eventName(lower);
  return { title: found ? `${found} Notice` : "School Event Notice", paras: [sentences.join(" ")] };
}

function timetableBody(ctx: Ctx): { title: string; paras: string[] } {
  const { lower, facts } = ctx;
  const subject = /(timing|timings|school time|school times)/.test(lower) ? "school timings" : "timetable";
  const season = /winter|sardi/.test(lower) ? "winter " : /summer|garmi/.test(lower) ? "summer " : "";
  const effect = ctx.main ? ctx.main.replace(/^(on|from) /, "") : ph(ctx, "date");
  const sentences = [
    `This is to inform ${ctx.who} that the ${season}${subject} ${subject === "timetable" ? "has" : "have"} been changed with effect from ${effect}.`,
  ];
  if (facts.timeRange) sentences.push(`The revised timing will be${atTime(ctx)}.`);
  else if (facts.time) sentences.push(`The revised time will be ${facts.time}.`);
  return { title: "Timetable Change Notice", paras: [sentences.join(" ")] };
}

function attendanceBody(ctx: Ctx): { title: string; paras: string[] } {
  const { lower, facts } = ctx;
  const sentences = [`This is to bring to the attention of ${ctx.who} the following about attendance.`];
  const details: string[] = [];
  if (facts.percent && KEYWORDS.mustWord.test(lower)) details.push(`An attendance of ${facts.percent} is required.`);
  else if (facts.percent) details.push(`Attendance of ${facts.percent} is mentioned in this notice.`);
  if (/\b(late|der se)\b/.test(lower)) details.push("Students are requested to reach school on time.");
  if (/(absent|ghair hazir|gair hazir|ghair haazir)/.test(lower)) details.push("Students are requested not to remain absent without informing the school.");
  if (/(regular|baqaida)/.test(lower)) details.push("Students are requested to attend school regularly.");
  if (ctx.main) details.push(`Please note ${ctx.main}.`);
  sentences.push(...details);
  return { title: "Attendance Notice", paras: [sentences.join(" ")] };
}

function homeworkBody(ctx: Ctx): { title: string; paras: string[] } {
  const { lower, facts } = ctx;
  const item = /assignment/.test(lower) ? "assignment" : /project/.test(lower) ? "project" : /worksheet/.test(lower) ? "worksheet" : "homework";
  const what = /assignments|worksheets|projects/.test(lower) ? `${item}s` : item;
  const done = KEYWORDS.complete.test(lower) ? "completed " : "";
  const act = KEYWORDS.bring.test(lower) ? "bring" : KEYWORDS.submit.test(lower) ? "submit" : "complete";
  const when = ctx.due ?? ctx.main ?? ph(ctx, "date");
  const students = facts.classes ? `Students of ${facts.classes}` : "All students";
  let sentence: string;
  if (act === "complete") {
    const by = /^(on |from )/.test(when) ? when.replace(/^(on|from) /, "by ") : /^(tomorrow|today|next|the day)/.test(when) ? `by ${when}` : `by ${when}`;
    sentence = `${students} are required to complete their ${what} ${by}${atTime(ctx)}.`;
  } else {
    const on = /^(on |from |tomorrow|today|next|the day)/.test(when) ? when : `on ${when}`;
    sentence = `${students} are required to ${act} their ${done}${what} ${on}${atTime(ctx)}.`;
  }
  return { title: "Homework Notice", paras: [sentence] };
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                    */
/* ------------------------------------------------------------------ */

const DEFAULT_TITLES: Record<NoticeType, string> = {
  "General Announcement": "General Notice",
  "Holiday": "Holiday Notice",
  "School Closure": "School Closure Notice",
  "Examination": "Examination Notice",
  "Parent-Teacher Meeting": "Parent-Teacher Meeting Notice",
  "Fee Reminder": "Fee Reminder Notice",
  "School Event": "School Event Notice",
  "Timetable Change": "Timetable Change Notice",
  "Attendance": "Attendance Notice",
  "Homework / Assignment": "Homework Notice",
};

export function generateNotice(form: FormState): GeneratedNotice {
  const raw = form.instructions.replace(/\r/g, "").trim();
  const warnings: string[] = [];
  const noticeDate = parseIsoDate(form.date);
  const lower = raw.toLowerCase();
  const facts = readFacts(raw, noticeDate, warnings);

  let type: NoticeType = form.noticeType;
  if (type === "General Announcement") {
    const guess = guessType(lower);
    if (guess) {
      type = guess;
      warnings.push(`Your instructions look like a "${guess}" notice, so that template was used.`);
    }
  }

  const ctx: Ctx = {
    lower,
    facts,
    who: audienceText(form.audience, facts.classes),
    main: phraseFor(facts.mentions, "main", warnings),
    reopen: phraseFor(facts.mentions, "reopen", warnings),
    due: phraseFor(facts.mentions, "due", warnings),
    placeholders: [],
    warnings,
    userTitle: form.noticeTitle.trim(),
  };

  let built: { title: string; paras: string[] } | null = null;
  switch (type) {
    case "Holiday": built = closureBody(ctx, "Holiday"); break;
    case "School Closure": built = closureBody(ctx, "School Closure"); break;
    case "Examination": built = examBody(ctx); break;
    case "Parent-Teacher Meeting": built = ptmBody(ctx); break;
    case "Fee Reminder": built = feeBody(ctx); break;
    case "School Event": built = eventBody(ctx); break;
    case "Timetable Change": built = timetableBody(ctx); break;
    case "Attendance": built = attendanceBody(ctx); break;
    case "Homework / Assignment": built = homeworkBody(ctx); break;
    default: built = null;
  }

  // Extra sentences the templates did not cover.
  const sentences = raw.split(/\n+|[.!?]+\s+|[.!?]+$/).map(clean).filter(Boolean);
  const extras: string[] = [];
  const untranslated: string[] = [];
  for (const s of sentences) {
    const isRoman = romanRatio(s) >= 0.3;
    const known = ANY_KNOWN.test(s.toLowerCase());
    if (type === "General Announcement" || built === null) {
      if (isRoman) untranslated.push(s); else extras.push(endSentence(cap(s)));
      continue;
    }
    if (known) continue;
    if (isRoman) untranslated.push(s); else extras.push(endSentence(cap(s)));
  }

  let paras: string[];
  let title: string;
  if (built) {
    paras = [...built.paras];
    title = built.title;
    if (type !== form.noticeType) title = DEFAULT_TITLES[type];
    if (extras.length) paras.push(extras.join(" "));
  } else {
    title = DEFAULT_TITLES["General Announcement"];
    paras = [`This is to inform ${ctx.who} of the following.`];
    if (ctx.main) paras.push(`Date: ${ctx.main.replace(/^on /, "")}${atTime(ctx)}.`);
    if (extras.length) paras.push(extras.join(" "));
    else paras.push("[Write the details of the announcement here]");
  }
  if (untranslated.length) {
    warnings.push(
      `Some Roman Urdu sentences could not be turned into English by the built-in rules: ${untranslated.map((u) => `"${u}"`).join(", ")}. Please type them in English inside the notice.`,
    );
  }
  if (ctx.userTitle) title = ctx.userTitle;

  const notice = paras.join("\n\n");
  const left = Array.from(new Set(notice.match(/\[[^\]]+\]/g) || []));
  if (left.length) warnings.unshift(`Fill in before you download: ${left.join(", ")}.`);

  return { title, notice, warnings };
}

/** True when the text still contains [placeholders]. */
export function hasPlaceholders(text: string): boolean {
  return /\[[^\]]+\]/.test(text);
}
