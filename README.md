# SchoolNotice AI

**Create clear school notices in seconds.**

A simple tool for teachers, head teachers and principals. Type your instructions in simple English or Roman Urdu,
pick the notice type and audience, and get a clear English notice. Edit it, then download it as a PDF.

> **Important:** this app does **not** use artificial intelligence or any online service. It is a
> *template-based notice generator*: it reads your instructions with simple rules (dates, times, amounts, common
> Roman Urdu words) and fills ready-made English templates. It works in your browser, needs **no API key**, **no
> account** and **no database**.

## What it can do
- Notice types: General Announcement, Holiday, School Closure, Examination, Parent-Teacher Meeting, Fee Reminder,
  School Event, Timetable Change, Attendance, Homework / Assignment
- Understands common Roman Urdu such as `kal`, `barish ki wajah se`, `band hai`, `khulega`, `baje`, `jama karwa den`,
  `Friday ko`, `next week se`
- Never invents facts. If a date, time or other detail is missing, it writes a placeholder like `[date]` for you to fill in
- Edit everything (school name, notice number, date, title, text, issued by) before you download
- **Download PDF** (made in your browser, no external service), Copy, Print (A4) and Clear
- Recent Notices are saved in your own browser only

## Limits (please read)
- The notice is always written in **English**. Urdu script is not supported by the generator or the PDF.
- The rules cover common school situations. For unusual announcements, the app writes an introduction and lets you type
  the details yourself.
- Always read the notice before you share it. Check dates, times and AM/PM.

## Run on your computer (Windows)
1. Install **Node.js LTS** from https://nodejs.org (accept the defaults).
2. Open the project folder in VS Code, then open the terminal: **Terminal > New Terminal**.
3. Run:
   ```
   npm install
   npm run dev
   ```
4. Open http://localhost:3000 in your browser.

To check the production build (the same build Vercel runs):
```
npm run build
```

## Put it on GitHub
1. Create a free account at https://github.com and click **New repository**. Name it `schoolnotice-ai`. Do not add a README.
2. In the VS Code terminal, run (replace `YOUR-USERNAME`):
   ```
   git init
   git add .
   git commit -m "SchoolNotice AI"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/schoolnotice-ai.git
   git push -u origin main
   ```

## Deploy to Vercel (free)
1. Go to https://vercel.com and sign up with your GitHub account.
2. Click **Add New > Project**, choose the `schoolnotice-ai` repository and click **Import**.
3. Leave all settings as they are (Vercel detects Next.js). **You do not need any environment variables.**
4. Click **Deploy**. After about a minute you get a live link.

## Project structure
```
app/page.tsx, layout.tsx, globals.css   Homepage, shell and styles (including A4 print styles)
components/NoticeGenerator.tsx          Main screen and actions (Download PDF, Copy, Print, Clear)
components/NoticeForm.tsx               The input form
components/NoticePreview.tsx            The editable notice document
components/RecentNotices.tsx, Toast.tsx Recent notices list and messages
lib/generator.ts                        The rules and templates that write the notice
lib/pdf.ts                              Small PDF writer that runs in the browser
lib/storage.ts, types.ts                Browser storage helpers and shared types
```

## Tech stack
Next.js 14, React 18, TypeScript, Tailwind CSS. No other runtime dependencies.
