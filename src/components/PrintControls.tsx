"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "./ui";

export function PrintControls({ auto }: { auto: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (auto) setTimeout(() => window.print(), 300);
  }, [auto]);
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[148mm] justify-between">
      <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="size-4" /> Back</Button>
      <Button size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
    </div>
  );
}
