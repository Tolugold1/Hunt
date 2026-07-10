import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { ApplicationStatus } from "@prisma/client";
import DeleteApplicationButton from "./DeleteApplicationButton";
import BackfillButton from "./BackfillButton";

const SEALED_STATUSES: ApplicationStatus[] = ["SENT", "APPROVED", "REPLIED", "INTERVIEW"];

const STATUS_LABELS: Record<ApplicationStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "text-yellow-400 bg-yellow-500/10" },
  APPROVED: { label: "Queued", color: "text-blue-400 bg-blue-500/10" },
  SENT: { label: "Sent", color: "text-green-400 bg-green-500/10" },
  FAILED: { label: "Failed", color: "text-red-400 bg-red-500/10" },
  REJECTED_BY_USER: { label: "Skipped", color: "text-gray-400 bg-gray-500/10" },
  REPLIED: { label: "Replied", color: "text-purple-400 bg-purple-500/10" },
  INTERVIEW: { label: "Interview", color: "text-pink-400 bg-pink-500/10" },
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; huntId?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id!;
  const { status, huntId } = await searchParams;

  const applications = await db.application.findMany({
    where: {
      userId,
      ...(status ? { status: status as ApplicationStatus } : {}),
      ...(huntId ? { huntId } : {}),
    },
    include: { hunt: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const statusCounts = await db.application.groupBy({
    by: ["status"],
    where: { userId },
    _count: true,
  });
  const counts = Object.fromEntries(statusCounts.map((r) => [r.status, r._count]));

  // Count buggy imported X jobs (markers the old fetcher left in the description).
  const dirtyXCount = await db.application.count({
    where: {
      userId,
      status: { notIn: SEALED_STATUSES },
      OR: [{ jobDescription: { contains: "on X" } }, { jobDescription: { contains: "🔗" } }],
    },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-gray-400 mt-1 text-sm">Review drafts, approve, and track responses.</p>
        </div>
        <Link
          href="/dashboard/applications/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Add job
        </Link>
      </div>

      {/* Backfill banner — fix buggy imported X jobs in place */}
      {dirtyXCount > 0 && <BackfillButton count={dirtyXCount} />}

      {/* Hunt filter banner */}
      {huntId && (
        <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5">
          <span className="text-sm text-blue-300">
            Showing applications from this hunt
          </span>
          <Link href="/dashboard/applications" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            Clear filter ×
          </Link>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: `All (${applications.length})`, href: huntId ? `/dashboard/applications?huntId=${huntId}` : "/dashboard/applications", active: !status },
          ...(["DRAFT", "APPROVED", "SENT", "REPLIED", "INTERVIEW"] as ApplicationStatus[]).map((s) => ({
            label: `${STATUS_LABELS[s].label} (${counts[s] ?? 0})`,
            href: `/dashboard/applications?status=${s}${huntId ? `&huntId=${huntId}` : ""}`,
            active: status === s,
          })),
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab.active ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Application list */}
      {applications.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-3xl mb-3">📭</div>
          <div className="text-gray-400">No applications yet.</div>
          <Link href="/dashboard/applications/new" className="text-blue-400 text-sm mt-2 inline-block hover:underline">
            Add your first job →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const s = STATUS_LABELS[app.status];
            return (
              <Link
                key={app.id}
                href={`/dashboard/applications/${app.id}`}
                className="block bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{app.jobTitle}</div>
                    <div className="text-gray-400 text-sm">{app.company}</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {app.matchScore != null && (
                      <div className="text-xs text-gray-500">{Math.round(app.matchScore * 100)}% match</div>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>
                      {s.label}
                    </span>
                    <DeleteApplicationButton applicationId={app.id} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                  {app.applyEmail && <span>→ {app.applyEmail}</span>}
                  {(app as typeof app & { hunt?: { name: string } | null }).hunt?.name && (
                    <span className="text-blue-500/70">
                      {(app as typeof app & { hunt?: { name: string } | null }).hunt!.name}
                    </span>
                  )}
                  <span>{new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
