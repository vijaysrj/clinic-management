import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";
import { Card, buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <PublicShell>
      <Card className="p-6 text-center">
        <h1 className="text-lg font-semibold">We couldn&apos;t find that patient ID</h1>
        <p className="mt-1 text-sm text-muted">Check the ID and try again, or ask at the front desk.</p>
        <Link href="/status" className={`${buttonClass("primary")} mt-4`}>Try again</Link>
      </Card>
    </PublicShell>
  );
}
