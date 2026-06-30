import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Suspense } from "react";
import RunHuntButton from "./RunHuntButton";
import HuntsToast from "./HuntsToast";
import DeleteHuntButton from "./DeleteHuntButton";

export default async function HuntsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const hunts = await db.hunt.findMany({
    where: { userId },
    include: { _count: { select: { applications: true, socialPosts: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      {/* Toast reads ?toast= param set by the new-hunt form on redirect */}
      <Suspense>
        <HuntsToast />
      </Suspense>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Hunts</h1>
          <p className="text-gray-400 mt-1 text-sm">A hunt = a saved automation that finds matches and drafts content.</p>
        </div>
        <Link
          href="/dashboard/hunts/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New hunt
        </Link>
      </div>

      {hunts.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-3xl mb-3">🎯</div>
          <div className="text-gray-400 mb-3">No hunts yet.</div>
          <Link href="/dashboard/hunts/new" className="text-blue-400 text-sm hover:underline">
            Create your first hunt →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {hunts.map((hunt) => {
            const itemCount = hunt.type === "JOB" ? hunt._count.applications : hunt._count.socialPosts;
            return (
              <div key={hunt.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${hunt.isActive ? "bg-green-500" : "bg-gray-600"}`} />
                      <div className="font-medium text-white truncate">{hunt.name}</div>
                      <span className="text-xs text-gray-600 uppercase tracking-wide shrink-0">{hunt.type}</span>
                    </div>
                    <div className="text-gray-500 text-sm mt-1 ml-4 truncate">
                      {hunt.type === "JOB"
                        ? hunt.keywords.slice(0, 4).join(", ") + (hunt.keywords.length > 4 ? ` +${hunt.keywords.length - 4} more` : "")
                        : `Topics: ${hunt.topics.join(", ")}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 mt-0.5">
                    <DeleteHuntButton huntId={hunt.id} huntName={hunt.name} />
                    <Link
                      href={`/dashboard/hunts/${hunt.id}/edit`}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Edit
                    </Link>
                    <RunHuntButton huntId={hunt.id} huntName={hunt.name} />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 ml-4">
                  <Link
                    href={`/dashboard/applications?huntId=${hunt.id}`}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {itemCount} {itemCount === 1 ? "application" : "applications"}
                  </Link>
                  <span className="text-xs text-gray-700 flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                    </svg>
                    Schedule: coming soon
                  </span>
                  {hunt.lastRunAt && (
                    <span className="text-xs text-gray-600">
                      Last run: {new Date(hunt.lastRunAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
