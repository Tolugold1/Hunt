import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-widest text-blue-400 border border-blue-500/30 rounded-full bg-blue-500/10 mb-4">
          Early Access
        </div>
        <h1 className="text-5xl font-bold text-white leading-tight">
          Hunt smarter.<br />
          <span className="text-blue-400">Apply faster.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-lg mx-auto">
          Upload your resume once. Hunt connects to job boards, drafts tailored cover letters,
          and sends applications from your own mailbox — while you sleep.
        </p>
        <div className="flex gap-4 justify-center pt-2">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/hunt-discussion.html"
            className="px-6 py-3 border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg font-semibold transition-colors"
          >
            How it works
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-6 pt-10 text-left">
          {[
            { icon: "📄", title: "Resume-grounded drafts", desc: "Cover letters reference your actual experience — nothing fabricated." },
            { icon: "📬", title: "Sends from your mailbox", desc: "Replies go to you. Recruiters see your real email address." },
            { icon: "⚡", title: "Approval-first by default", desc: "Review every draft before it sends. Go full-auto when you trust it." },
          ].map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-white text-sm mb-1">{f.title}</div>
              <div className="text-gray-500 text-sm">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
