import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Hunts</h1>
          <p className="text-gray-400 mt-1 text-sm">A hunt = a saved search that runs on a schedule.</p>
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
          {hunts.map((hunt) => (
            <div key={hunt.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-white">{hunt.name}</div>
                  <div className="text-gray-400 text-sm mt-0.5">
                    {hunt.type === "JOB"
                      ? `${hunt.keywords.join(", ")} · ${hunt.sources.join(", ")}`
                      : `Topics: ${hunt.topics.join(", ")}`}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`w-2 h-2 rounded-full ${hunt.isActive ? "bg-green-500" : "bg-gray-600"}`} />
                  <span className="text-xs text-gray-500 capitalize">{hunt.type}</span>
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span>{hunt.type === "JOB" ? hunt._count.applications : hunt._count.socialPosts} items</span>
                {hunt.cronExpression && <span>Schedule: {hunt.cronExpression}</span>}
                {hunt.lastRunAt && <span>Last run: {new Date(hunt.lastRunAt).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
