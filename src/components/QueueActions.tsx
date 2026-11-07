"use client";

import { useState, useTransition } from "react";
import { DoorOpen, LogIn, MoreHorizontal, Undo2, UserCheck, X } from "lucide-react";
import { Button, Input, cx } from "./ui";
import { completeVisit, setStatus } from "@/app/staff/queue/actions";

type Mode = "cash" | "upi" | "card" | "other";
const MODES: { v: Mode; label: string }[] = [
  { v: "cash", label: "Cash" },
  { v: "upi", label: "UPI" },
  { v: "card", label: "Card" },
  { v: "other", label: "Other" },
];

export function QueueActions({
  id,
  status,
  defaultFee,
  payment,
}: {
  id: number;
  status: string;
  defaultFee: number | null;
  payment: { amount: number; mode: Mode } | null;
}) {
  const [pending, start] = useTransition();
  const [paying, setPaying] = useState(false);
  const [more, setMore] = useState(false);
  const [amount, setAmount] = useState(String(payment?.amount ?? defaultFee ?? ""));
  const [mode, setMode] = useState<Mode>(payment?.mode ?? "cash");
  const [error, setError] = useState<string | null>(null);

  const go = (next: Parameters<typeof setStatus>[1]) => start(() => setStatus(id, next));

  if (paying) {
    return (
      <form
        className="mt-3 w-full space-y-3 rounded-xl border border-line bg-canvas p-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            try {
              await completeVisit({ appointmentId: id, amount: amount || "0", mode });
              setPaying(false);
            } catch {
              setError("Could not save. Please try again.");
            }
          });
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted">₹</span>
          <Input autoFocus inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="Amount" className="h-10" />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMode(m.v)}
              className={cx("h-9 rounded-lg border text-sm font-medium", mode === m.v ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white")}
            >
              {m.label}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPaying(false)}>Back</Button>
          <Button type="submit" size="sm" disabled={pending}>{status === "completed" ? "Update payment" : "Save & complete"}</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "booked" && <Button size="sm" variant="secondary" disabled={pending} onClick={() => go("arrived")}><UserCheck className="size-4" /> Arrived</Button>}
      {(status === "booked" || status === "arrived") && <Button size="sm" disabled={pending} onClick={() => go("in_consultation")}><LogIn className="size-4" /> Gone in</Button>}
      {status === "in_consultation" && <Button size="sm" disabled={pending} onClick={() => setPaying(true)}><DoorOpen className="size-4" /> Completed</Button>}
      {status === "completed" && <Button size="sm" variant="ghost" onClick={() => setPaying(true)}>Edit payment</Button>}
      {status === "no_show" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("booked")}><Undo2 className="size-4" /> Undo</Button>}
      {status === "in_consultation" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("arrived")}><Undo2 className="size-4" /> Back to waiting</Button>}
      {(status === "booked" || status === "arrived") && (
        <div className="relative">
          <Button size="sm" variant="ghost" aria-label="More" onClick={() => setMore(!more)}><MoreHorizontal className="size-4" /></Button>
          {more && (
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-line bg-white p-1 shadow-lg">
              <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-canvas" onClick={() => { setMore(false); go("no_show"); }}>Mark no-show</button>
              <button className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" onClick={() => { setMore(false); if (confirm("Cancel this appointment?")) go("cancelled"); }}><X className="size-4" /> Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
