import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const signOutSlot = (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        Sign out
      </button>
    </form>
  );

  return (
    <DashboardShell email={session.user.email ?? ""} signOutSlot={signOutSlot}>
      {children}
    </DashboardShell>
  );
}
