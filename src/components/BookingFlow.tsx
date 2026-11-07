"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Clock } from "lucide-react";
import { Button, Card, ErrorNote, Field, Input, Select, cx } from "./ui";
import type { BookingForm, BookingResult } from "@/lib/bookingSchema";

type Doctor = { id: number; displayName: string; specialty: string | null; consultationFee: number | null };
type Day = { date: string; free: number; total: number };
type Slot = { startMin: number; endMin: number; tokenNo: number; available: boolean; past: boolean };

function fmt(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function dayParts(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    wd: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
    day: d.getUTCDate(),
    mon: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
  };
}
function period(min: number) {
  return min < 12 * 60 ? "Morning" : min < 16 * 60 ? "Afternoon" : "Evening";
}

export function BookingFlow({
  doctors,
  initialDoctorId,
  action,
  staffMode = false,
}: {
  doctors: Doctor[];
  initialDoctorId?: number;
  action: (f: BookingForm) => Promise<BookingResult>;
  staffMode?: boolean;
}) {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<number | null>(initialDoctorId ?? (doctors.length === 1 ? doctors[0].id : null));
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", phone: "", age: "", gender: "", patientCode: "" });

  useEffect(() => {
    if (!doctorId) return;
    setDays(null); setDate(null); setSlots(null); setSlot(null);
    fetch(`/api/days?doctorId=${doctorId}`).then((r) => r.json()).then((j) => {
      setDays(j.days);
      const first = (j.days as Day[]).find((d) => d.free > 0);
      if (first) setDate(first.date);
    });
  }, [doctorId]);

  const loadSlots = (dId: number, dt: string) =>
    fetch(`/api/slots?doctorId=${dId}&date=${dt}`).then((r) => r.json()).then((j) => setSlots(j.slots));

  useEffect(() => {
    if (!doctorId || !date) return;
    setSlots(null); setSlot(null);
    loadSlots(doctorId, date);
  }, [doctorId, date]);

  const grouped = useMemo(() => {
    const g: Record<string, Slot[]> = {};
    for (const s of slots ?? []) if (!s.past) (g[period(s.startMin)] ??= []).push(s);
    return Object.entries(g);
  }, [slots]);

  const doctor = doctors.find((d) => d.id === doctorId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorId || !date || !slot) return;
    setError(null);
    start(async () => {
      const res = await action({ doctorId, date, startMin: slot.startMin, ...form });
      if (res.ok) router.push(staffMode ? `/staff/queue?highlight=${res.appointmentId}` : `/status/${res.code}?booked=${res.appointmentId}`);
      else {
        setError(res.error);
        if (res.error.includes("taken")) { setSlot(null); loadSlots(doctorId, date); }
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Doctor */}
      <Card className="p-4">
        <div className="mb-3 text-sm font-semibold">1. Doctor</div>
        {doctors.length === 0 ? (
          <p className="text-sm text-muted">No doctors are taking bookings yet.</p>
        ) : (
          <div className="grid gap-2">
            {doctors.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDoctorId(d.id)}
                className={cx(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                  d.id === doctorId ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-line hover:bg-canvas",
                )}
              >
                <span>
                  <span className="block font-medium">{d.displayName}</span>
                  {d.specialty && <span className="block text-sm text-muted">{d.specialty}</span>}
                </span>
                {d.id === doctorId && <Check className="size-5 text-brand-600" />}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Date */}
      {doctorId && (
        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold">2. Day</div>
          {!days ? (
            <div className="h-20 animate-pulse rounded-xl bg-canvas" />
          ) : days.every((d) => d.free === 0) ? (
            <p className="text-sm text-muted">No open slots in the next two weeks. Please call the clinic.</p>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {days.map((d) => {
                const p = dayParts(d.date);
                const off = d.free === 0;
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={off}
                    onClick={() => setDate(d.date)}
                    className={cx(
                      "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors",
                      d.date === date ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-brand-50",
                      off && "opacity-40",
                    )}
                  >
                    <span className="text-xs">{p.wd}</span>
                    <span className="text-lg font-semibold leading-tight">{p.day}</span>
                    <span className="text-xs">{off ? (d.total ? "Full" : "Off") : p.mon}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Slot */}
      {date && (
        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold">3. Time</div>
          {!slots ? (
            <div className="h-24 animate-pulse rounded-xl bg-canvas" />
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted">No slots left on this day.</p>
          ) : (
            <div className="space-y-4">
              {grouped.map(([label, list]) => (
                <div key={label}>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {list.map((s) => (
                      <button
                        key={s.startMin}
                        type="button"
                        disabled={!s.available}
                        onClick={() => setSlot(s)}
                        className={cx(
                          "h-10 rounded-lg border text-sm font-medium transition-colors",
                          slot?.startMin === s.startMin
                            ? "border-brand-600 bg-brand-600 text-white"
                            : s.available
                              ? "border-line bg-white hover:border-brand-500 hover:bg-brand-50"
                              : "border-transparent bg-canvas text-muted/60 line-through",
                        )}
                      >
                        {fmt(s.startMin)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Details */}
      {slot && (
        <Card className="p-4">
          <div className="mb-1 text-sm font-semibold">4. Patient details</div>
          <p className="mb-4 flex items-center gap-1.5 text-sm text-muted">
            <Clock className="size-4" /> {doctor?.displayName} · {dayParts(date!).wd} {dayParts(date!).day} {dayParts(date!).mon} · {fmt(slot.startMin)} · Token {slot.tokenNo}
          </p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Patient name">
              <Input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </Field>
            <Field label="Mobile number">
              <Input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <Input inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="Years" />
              </Field>
              <Field label="Gender">
                <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
            </div>
            <Field label="Patient ID (if you have one)" hint="Visited before? Enter your ID to keep your history together. Otherwise we'll create one.">
              <Input value={form.patientCode} onChange={(e) => setForm({ ...form, patientCode: e.target.value })} placeholder="PT-XXXXXX" />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setSlot(null)}><ChevronLeft className="size-4" /> Change time</Button>
              <Button type="submit" size="lg" className="flex-1" disabled={pending}>
                {pending ? "Booking…" : staffMode ? "Book walk-in" : "Confirm booking"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
