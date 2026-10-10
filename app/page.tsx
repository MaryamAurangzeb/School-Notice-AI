import NoticeGenerator from "@/components/NoticeGenerator";

export default function Home() {
  return (
    <>
      <header className="no-print border-b border-line bg-white">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
        >
          <a href="#top" className="font-serif text-xl font-bold text-ink">
            SchoolNotice <span className="text-brand">AI</span>
          </a>
          <a
            href="#create"
            className="inline-flex min-h-[44px] items-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:border-brand hover:text-brand-dark"
          >
            Create Notice
          </a>
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="no-print py-14 sm:py-20" aria-labelledby="hero-heading">
          <p className="inline-flex items-center rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-dark">
            School Notice Generator
          </p>
          <h1
            id="hero-heading"
            className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-[1.1] text-ink [text-wrap:balance] sm:text-6xl"
          >
            Create clear school notices in seconds.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            Turn short instructions in simple English or Roman Urdu into clear, ready-to-share school notices. Edit them, then download a PDF. No account or API key needed.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="#create"
              className="inline-flex min-h-[52px] items-center rounded-md bg-brand px-7 text-base font-semibold text-white hover:bg-brand-dark"
            >
              Create Notice
            </a>
            <p className="text-sm text-muted">Built for teachers, principals, and school staff.</p>
          </div>
        </section>

        <div className="pb-16 print-shell">
          <NoticeGenerator />
        </div>
      </main>

      <footer className="no-print border-t border-line bg-white">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
          SchoolNotice AI is a template-based notice generator. It does not use an AI service. Please read every notice before you share it.
        </p>
      </footer>
    </>
  );
}
