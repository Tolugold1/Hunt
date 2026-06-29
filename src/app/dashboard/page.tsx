import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [profile, applicationCounts, huntCount] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.application.groupBy({
      by: ["status"],
      where: { userId },
      _count: true,
    }),
    db.hunt.count({ where: { userId } }),
  ]);

  const countsByStatus = Object.fromEntries(
    applicationCounts.map((r) => [r.status, r._count])
  );

  const stats = [
    { label: "Active Hunts", value: huntCount, href: "/dashboard/hunts" },
    { label: "Drafts to Review", value: countsByStatus.DRAFT ?? 0, href: "/dashboard/applications?status=DRAFT" },
    { label: "Sent", value: countsByStatus.SENT ?? 0, href: "/dashboard/applications?status=SENT" },
    { label: "Replies", value: countsByStatus.REPLIED ?? 0, href: "/dashboard/applications?status=REPLIED" },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back{profile?.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-gray-400 mt-1">Here&apos;s what&apos;s happening with your hunts.</p>
      </div>

      {!profile?.resumeUrl && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-amber-400 font-semibold text-sm">Resume not uploaded</div>
            <div className="text-amber-300/70 text-xs mt-0.5">Upload your resume to start applying to jobs.</div>
          </div>
          <Link
            href="/dashboard/profile"
            className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Upload resume
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-600 transition-colors"
          >
            <div className="text-3xl font-bold text-white">{s.value}</div>
            <div className="text-gray-400 text-sm mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">Quick actions</h2>
          <div className="space-y-2">
            <Link href="/dashboard/applications/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-sm text-gray-300 hover:text-white transition-colors">
              <span className="text-blue-400">+</span> Add a job manually
            </Link>
            <Link href="/dashboard/hunts/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-sm text-gray-300 hover:text-white transition-colors">
              <span className="text-green-400">+</span> Create a new hunt
            </Link>
            <Link href="/dashboard/profile" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 text-sm text-gray-300 hover:text-white transition-colors">
              <span className="text-purple-400">↑</span> Update resume
            </Link>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">Application pipeline</h2>
          {applicationCounts.length === 0 ? (
            <p className="text-gray-500 text-sm">No applications yet. Add a job to get started.</p>
          ) : (
            <div className="space-y-2">
              {[
                ["DRAFT", "Drafts", "text-yellow-400"],
                ["APPROVED", "Queued to send", "text-blue-400"],
                ["SENT", "Sent", "text-green-400"],
                ["REPLIED", "Replied", "text-purple-400"],
                ["INTERVIEW", "Interviews", "text-pink-400"],
              ].map(([status, label, color]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className={`${color}`}>{label}</span>
                  <span className="text-gray-400">{countsByStatus[status] ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
