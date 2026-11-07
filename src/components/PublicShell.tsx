import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

type Clinic = { slug: string; name: string; address: string | null; phone: string | null };

export function PublicShell({ clinic, children }: { clinic: Clinic; children: React.ReactNode }) {
  const base = `/c/${clinic.slug}`;
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4">
      <header className="flex items-center justify-between py-5">
        <Link href={base} className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <Stethoscope className="size-5" />
          </span>
          <span className="truncate text-[17px] font-semibold tracking-tight">{clinic.name}</span>
        </Link>
        <nav className="flex shrink-0 gap-1 text-sm">
          <Link href={`${base}/book`} className="rounded-lg px-3 py-1.5 text-muted hover:bg-white hover:text-ink">Book</Link>
          <Link href={`${base}/status`} className="rounded-lg px-3 py-1.5 text-muted hover:bg-white hover:text-ink">My status</Link>
        </nav>
      </header>
      <main className="flex-1 pb-12">{children}</main>
      <footer className="py-6 text-center text-xs text-muted">
        {clinic.address}
        {clinic.phone && <> · {clinic.phone}</>}
        <div className="mt-2 flex justify-center gap-3">
          <Link href="/login" className="hover:text-ink">Staff sign in</Link>
          <span>·</span>
          <Link href="/" className="hover:text-ink">Powered by {APP_NAME}</Link>
        </div>
      </footer>
    </div>
  );
}
