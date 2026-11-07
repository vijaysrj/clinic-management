import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, LogOut, Stethoscope } from "lucide-react";
import { destroySession, requireUser } from "@/lib/auth";
import { getBranch } from "@/lib/booking";
import { StaffNav, type NavItem } from "@/components/StaffNav";

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const branch = await getBranch(user.branchId);
  const items: NavItem[] = [
    { href: "/staff/queue", label: "Today's queue", icon: "queue" },
    ...(user.role === "doctor"
      ? ([
          { href: "/staff/pad", label: "Doctor's pad", icon: "pad" },
          { href: "/staff/patients", label: "Patients", icon: "patients" },
          { href: "/staff/reports", label: "Reports", icon: "reports" },
        ] as NavItem[])
      : []),
    { href: "/staff/book", label: "Walk-in booking", icon: "book" },
    { href: "/staff/schedules", label: "Schedules", icon: "schedules" },
  ];
  if (user.isAdmin) items.push({ href: "/staff/team", label: "Team", icon: "team" });

  return (
    <div className="min-h-dvh md:flex">
      <aside className="no-print border-b border-line bg-canvas p-3 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0 md:p-4">
        <Link href="/staff" className="mb-4 hidden items-center gap-2.5 px-2 md:flex">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white"><Stethoscope className="size-5" /></span>
          <span className="font-semibold leading-tight">{branch?.name ?? "Clinic"}</span>
        </Link>
        <StaffNav items={items} />
        {branch && (
          <Link href={`/c/${branch.slug}`} target="_blank" className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-white hover:text-ink">
            <ExternalLink className="size-4" /> Patient booking page
          </Link>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 md:mt-4 md:block md:pt-4">
          <div>
            <div className="px-2 text-sm font-medium">{user.name}</div>
            <div className="px-2 text-xs capitalize text-muted">{user.role}{user.isAdmin ? " · admin" : ""}</div>
          </div>
          <form action={logout}>
            <button className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-white hover:text-ink"><LogOut className="size-4" /> Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
