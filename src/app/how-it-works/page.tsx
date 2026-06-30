import Link from "next/link";

const steps = [
  {
    n: "01",
    title: "Upload your resume once",
    body: "Drop a PDF or Word doc. Hunt reads it with AI and extracts your skills, job titles, years of experience, and salary expectations. Everything it writes is grounded in your actual background — nothing fabricated.",
  },
  {
    n: "02",
    title: "Create a Hunt",
    body: "A Hunt is a saved automation rule. You tell it what job titles to look for, which job boards to scan, how often to run, and whether to send automatically or wait for your approval first.",
  },
  {
    n: "03",
    title: "Hunt finds jobs & scores them",
    body: "When the schedule fires, the Hunt worker fetches listings from your chosen sources and scores each one against your resume using AI. Low-scoring jobs are skipped automatically.",
  },
  {
    n: "04",
    title: "Tailored cover letters are drafted",
    body: "For each matched job, Hunt writes a cover letter that references your specific experience. It reads the job description and connects the dots to things in your resume — no generic templates.",
  },
  {
    n: "05",
    title: "You review (or it sends automatically)",
    body: "With approval mode on, drafts appear in your Applications tab. You read, edit, approve, or reject each one. Turn approval off and Hunt sends straight away — your call.",
  },
  {
    n: "06",
    title: "Sent from your own Gmail",
    body: "Applications go out from your real email address via the Gmail API. Recruiters reply directly to you. Hunt never touches your inbox — it only sends.",
  },
];

const socialSteps = [
  {
    n: "01",
    title: "Create a Social Hunt",
    body: "Pick topics (e.g. \"React, TypeScript, remote work\"), choose platforms (LinkedIn, X, Bluesky), and set a tone and posting schedule.",
  },
  {
    n: "02",
    title: "Hunt finds relevant content",
    body: "The scheduler discovers trending articles and discussions on your topics from across the web.",
  },
  {
    n: "03",
    title: "Platform-native posts are drafted",
    body: "LinkedIn posts read differently from tweets. Hunt generates the right format, length, and tone for each platform automatically.",
  },
  {
    n: "04",
    title: "Review and publish",
    body: "Approve posts in one click or let them publish on schedule. Your social presence stays active without you having to think about it.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen px-4 py-16">
      <div className="max-w-2xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm">← Back</Link>
          <h1 className="text-4xl font-bold text-white mt-4">How Hunt works</h1>
          <p className="text-gray-400 text-lg">
            One resume. Zero job boards. Applications sent while you sleep.
          </p>
        </div>

        {/* Job flow */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400 border border-blue-500/30 rounded-full px-3 py-1 bg-blue-500/10">
              Job Hunting
            </span>
          </div>
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-5 bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-2xl font-bold text-gray-700 shrink-0 w-8">{s.n}</div>
                <div>
                  <div className="font-semibold text-white text-sm mb-1">{s.title}</div>
                  <div className="text-gray-400 text-sm leading-relaxed">{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Social flow */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400 border border-emerald-500/30 rounded-full px-3 py-1 bg-emerald-500/10">
              Social Presence
            </span>
          </div>
          <div className="space-y-3">
            {socialSteps.map((s) => (
              <div key={s.n} className="flex gap-5 bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-2xl font-bold text-gray-700 shrink-0 w-8">{s.n}</div>
                <div>
                  <div className="font-semibold text-white text-sm mb-1">{s.title}</div>
                  <div className="text-gray-400 text-sm leading-relaxed">{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Key facts */}
        <section className="grid grid-cols-2 gap-4">
          {[
            { label: "Your data stays yours", desc: "Resume stored in Cloudinary under your account. Never used to train models." },
            { label: "Approval-first by default", desc: "Every hunt starts with manual approval turned on. You decide when to go full-auto." },
            { label: "Multi-LLM", desc: "Switch between Claude, GPT-4o, and Gemini from Settings. Same outputs, your preferred provider." },
            { label: "Open source", desc: "Self-host it, fork it, contribute to it. MIT licensed." },
          ].map((f) => (
            <div key={f.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="font-semibold text-white text-sm mb-1">{f.label}</div>
              <div className="text-gray-500 text-sm">{f.desc}</div>
            </div>
          ))}
        </section>

        <div className="text-center pt-4">
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
          >
            Get started →
          </Link>
        </div>
      </div>
    </main>
  );
}
