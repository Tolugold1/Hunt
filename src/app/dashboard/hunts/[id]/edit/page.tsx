import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import HuntForm from "../../HuntForm";

export default async function EditHuntPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const hunt = await db.hunt.findUnique({ where: { id } });
  if (!hunt) notFound();
  if (hunt.userId !== session.user.id) notFound();

  return (
    <HuntForm
      mode="edit"
      huntId={hunt.id}
      initial={{
        name: hunt.name,
        description: hunt.description ?? undefined,
        type: hunt.type,
        keywords: hunt.keywords,
        location: hunt.location ?? undefined,
        remoteOnly: hunt.remoteOnly,
        salaryMin: hunt.salaryMin,
        salaryCurrency: hunt.salaryCurrency ?? "USD",
        sources: hunt.sources,
        customSources: hunt.customSources,
        topics: hunt.topics,
        platforms: hunt.platforms,
        tone: hunt.tone ?? "professional",
        cronExpression: hunt.cronExpression ?? "",
        maxActionsPerRun: hunt.maxActionsPerRun,
        approvalRequired: hunt.approvalRequired,
      }}
    />
  );
}
