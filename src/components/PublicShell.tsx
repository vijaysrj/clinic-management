import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { getDefaultBranch } from "@/lib/booking";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const branch = await getDefaultBranch();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">
            <Stethoscope className="size-5" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">{branch?.name ?? "Clinic"}</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          <Link href="/book" className="rounded-lg px-3 py-1.5 text-muted hover:bg-white hover:text-ink">Book</Link>
          <Link href="/status" className="rounded-lg px-3 py-1.5 text-muted hover:bg-white hover:text-ink">My status</Link>
        </nav>
      </header>
      <main className="flex-1 pb-12">{children}</main>
      <footer className="py-6 text-center text-xs text-muted">
        {branch?.address}
        {branch?.phone && <> · {branch.phone}</>}
        <div className="mt-2"><Link href="/login" className="hover:text-ink">Staff sign in</Link></div>
      </footer>
    </div>
  );
}
