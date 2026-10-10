export const NOTICE_TYPES = [
  "General Announcement",
  "Holiday",
  "School Closure",
  "Examination",
  "Parent-Teacher Meeting",
  "Fee Reminder",
  "School Event",
  "Timetable Change",
  "Attendance",
  "Homework / Assignment",
] as const;
export const AUDIENCES = [
  "Parents and Students",
  "Parents",
  "Students",
  "Teachers and Staff",
  "All Concerned",
] as const;
export const ISSUERS = ["Principal", "Head Teacher", "School Administration", "Class Teacher"] as const;

export type NoticeType = (typeof NOTICE_TYPES)[number];
export type Audience = (typeof AUDIENCES)[number];
export type Issuer = (typeof ISSUERS)[number];

/** Everything the user types or picks in the form. */
export interface FormState {
  instructions: string;
  schoolName: string;
  noticeTitle: string;
  date: string;
  noticeNumber: string;
  issuedBy: Issuer;
  noticeType: NoticeType;
  audience: Audience;
}

/** What the template generator returns. `warnings` are tips for the user and are never printed on the notice. */
export interface GeneratedNotice {
  title: string;
  notice: string;
  warnings: string[];
}

/** The editable document shown in the preview and saved in Recent Notices. */
export interface NoticeDraft {
  title: string;
  notice: string;
  schoolName: string;
  noticeNumber: string;
  date: string;
  issuedBy: Issuer;
  noticeType: NoticeType;
}

export interface SavedNotice extends NoticeDraft {
  id: string;
  createdAt: number;
}

export const ERROR_MESSAGES = {
  EMPTY_INPUT: "Please write your notice instructions first.",
} as const;
