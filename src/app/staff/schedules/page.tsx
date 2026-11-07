import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, gte } from "drizzle-orm";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { getDoctor, listDoctors } from "@/lib/booking";
import { WEEKDAYS, fmtDate, fmtMinutes, parseHHMM, todayISO } from "@/lib/time";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

const { scheduleSessions, scheduleExceptions } = schema;
const SLOT_CHOICES = [5, 10, 15, 20, 30];

/** Doctors may edit only their own schedule; receptionists and admins any in their branch. */
async function assertCanEdit(user: SessionUser, doctorId: number) {
  const d = await getDoctor(doctorId);
  if (!d || d.branchId !== user.branchId) throw new Error("Unknown doctor");
  if (user.role === "doctor" && !user.isAdmin && user.doctorId !== doctorId) throw new Error("Not allowed");
}

const back = (doctorId: number, e?: string) => redirect(`/staff/schedules?doctor=${doctorId}${e ? `&e=${encodeURIComponent(e)}` : ""}`);

async function addSession(formData: FormData) {
  "use server";
  const user = await requireUser();
  const doctorId = Number(formData.get("doctorId"));
  await assertCanEdit(user, doctorId);
  const days = formData.getAll("weekday").map(Number).filter((n) => n >= 0 && n <= 6);
  const startMin = parseHHMM(String(formData.get("start")));
  const endMin = parseHHMM(String(formData.get("end")));
  const slotMinutes = Number(formData.get("slot"));
  if (!days.length) back(doctorId, "Pick at least one day.");
  if (!(endMin > startMin)) back(doctorId, "End time must be after start time.");
  if (!(slotMinutes >= 1 && slotMinutes <= 120)) back(doctorId, "Slot length must be 1 to 120 minutes.");
  if (endMin - startMin < slotMinutes) back(doctorId, "The session is shorter than one slot.");

  const existing = await db.select().from(scheduleSessions).where(eq(scheduleSessions.doctorId, doctorId));
  const clash = existing.find((s) => days.includes(s.weekday) && s.startMin < endMin && startMin < s.endMin);
  if (clash) back(doctorId, `Overlaps the ${WEEKDAYS[clash.weekday]} session ${fmtMinutes(clash.startMin)} to ${fmtMinutes(clash.endMin)}.`);

  await db.insert(scheduleSessions).values(days.map((weekday) => ({ doctorId, weekday, startMin, endMin, slotMinutes })));
  revalidatePath("/staff/schedules");
  back(doctorId);
}

async function deleteSession(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const doctorId = Number(formData.get("doctorId"));
  await assertCanEdit(user, doctorId);
  await db.delete(scheduleSessions).where(and(eq(scheduleSessions.id, id), eq(scheduleSessions.doctorId, doctorId)));
  revalidatePath("/staff/schedules");
  back(doctorId);
}

async function addException(formData: FormData) {
  "use server";
  const user = await requireUser();
  const doctorId = Number(formData.get("doctorId"));
  await assertCanEdit(user, doctorId);
  const date = String(formData.get("date"));
  const type = String(formData.get("type")) === "custom" ? "custom" : "leave";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back(doctorId, "Pick a date.");
  let startMin: number | null = null, endMin: number | null = null, slotMinutes: number | null = null;
  if (type === "custom") {
    startMin = parseHHMM(String(formData.get("start")));
    endMin = parseHHMM(String(formData.get("end")));
    slotMinutes = Number(formData.get("slot"));
    if (!(endMin > startMin) || !(slotMinutes >= 1)) back(doctorId, "Check the special hours.");
  }
  await db.insert(scheduleExceptions).values({ doctorId, date, type, startMin, endMin, slotMinutes, note: String(formData.get("note") ?? "") || null });
  revalidatePath("/staff/schedules");
  back(doctorId);
}

async function deleteException(formData: FormData) {
  "use server";
  const user = await requireUser();
  const doctorId = Number(formData.get("doctorId"));
  await assertCanEdit(user, doctorId);
  await db.delete(scheduleExceptions).where(and(eq(scheduleExceptions.id, Number(formData.get("id"))), eq(scheduleExceptions.doctorId, doctorId)));
  revalidatePath("/staff/schedules");
  back(doctorId);
}

export default async function SchedulesPage({ searchParams }: { searchParams: Promise<{ doctor?: string; e?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const doctors = await listDoctors(user.branchId);
  const doctorId = sp.doctor ? Number(sp.doctor) : user.doctorId ?? doctors[0]?.id;
  const doctor = doctors.find((d) => d.id === doctorId);
  const canEdit = !!doctor && (user.role === "receptionist" || user.isAdmin || user.doctorId === doctor.id);

  if (!doctor) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Schedules" />
        <Card className="p-6 text-sm text-muted">No doctors yet. An admin can add one under Team.</Card>
      </div>
    );
  }

  const [sessions, exceptions] = await Promise.all([
    db.select().from(scheduleSessions).where(eq(scheduleSessions.doctorId, doctor.id)).orderBy(asc(scheduleSessions.weekday), asc(scheduleSessions.startMin)),
    db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.doctorId, doctor.id), gte(scheduleExceptions.date, todayISO()))).orderBy(asc(scheduleExceptions.date)),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Schedules" subtitle="Set when each doctor sees patients and how long each slot is. Changes don't move existing bookings." />

      {doctors.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {doctors.map((d) => (
            <Link key={d.id} href={`?doctor=${d.id}`} className={cx("rounded-full border px-3 py-1.5 text-sm", d.id === doctor.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:bg-brand-50")}>
              {d.displayName}
            </Link>
          ))}
        </div>
      )}

      {sp.e && <div className="mb-4"><ErrorNote>{sp.e}</ErrorNote></div>}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="border-b border-line px-4 py-3 font-semibold">Weekly hours</div>
          {WEEKDAYS.map((name, wd) => {
            const list = sessions.filter((s) => s.weekday === wd);
            return (
              <div key={wd} className="flex items-start gap-4 border-b border-line px-4 py-3 last:border-0">
                <div className="w-24 shrink-0 pt-1 text-sm font-medium">{name}</div>
                <div className="flex flex-1 flex-wrap gap-2">
                  {list.length === 0 && <span className="pt-1 text-sm text-muted">Closed</span>}
                  {list.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-2 rounded-lg bg-brand-50 py-1 pr-1 pl-3 text-sm text-brand-700">
                      {fmtMinutes(s.startMin)} to {fmtMinutes(s.endMin)} · {s.slotMinutes} min
                      {canEdit && (
                        <form action={deleteSession}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="doctorId" value={doctor.id} />
                          <button aria-label="Remove" className="rounded-md p-1 hover:bg-brand-100"><Trash2 className="size-3.5" /></button>
                        </form>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>

        {canEdit && (
          <Card className="h-fit p-4">
            <div className="mb-3 font-semibold">Add hours</div>
            <form action={addSession} className="space-y-3">
              <input type="hidden" name="doctorId" value={doctor.id} />
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((n, i) => (
                  <label key={i} className="cursor-pointer">
                    <input type="checkbox" name="weekday" value={i} defaultChecked={i >= 1 && i <= 6} className="peer sr-only" />
                    <span className="grid h-9 place-items-center rounded-lg border border-line text-xs font-medium peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white">{n.slice(0, 2)}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="From"><Input type="time" name="start" defaultValue="09:00" required /></Field>
                <Field label="To"><Input type="time" name="end" defaultValue="13:00" required /></Field>
              </div>
              <Field label="Slot length">
                <Select name="slot" defaultValue="10">
                  {SLOT_CHOICES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </Select>
              </Field>
              <Button type="submit" className="w-full"><Plus className="size-4" /> Add</Button>
            </form>
          </Card>
        )}
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Leave and special days</h2>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          {exceptions.length === 0 && <p className="p-4 text-sm text-muted">No upcoming leave or special hours.</p>}
          {exceptions.map((x) => (
            <div key={x.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              <CalendarOff className={cx("size-5", x.type === "leave" ? "text-amber-600" : "text-sky-600")} />
              <div className="flex-1 text-sm">
                <div className="font-medium">{fmtDate(x.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
                <div className="text-muted">
                  {x.type === "leave" ? "On leave" : `Special hours ${fmtMinutes(x.startMin!)} to ${fmtMinutes(x.endMin!)} · ${x.slotMinutes} min`}
                  {x.note && ` · ${x.note}`}
                </div>
              </div>
              {canEdit && (
                <form action={deleteException}>
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="doctorId" value={doctor.id} />
                  <Button variant="ghost" size="sm" aria-label="Remove"><Trash2 className="size-4" /></Button>
                </form>
              )}
            </div>
          ))}
        </Card>
        {canEdit && (
          <Card className="h-fit p-4">
            <div className="mb-3 font-semibold">Add leave or special hours</div>
            <form action={addException} className="space-y-3">
              <input type="hidden" name="doctorId" value={doctor.id} />
              <Field label="Date"><Input type="date" name="date" min={todayISO()} required /></Field>
              <Field label="Type">
                <Select name="type" defaultValue="leave">
                  <option value="leave">On leave (no bookings)</option>
                  <option value="custom">Special hours (replace usual hours)</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="From"><Input type="time" name="start" defaultValue="10:00" /></Field>
                <Field label="To"><Input type="time" name="end" defaultValue="12:00" /></Field>
              </div>
              <Field label="Slot length">
                <Select name="slot" defaultValue="10">{SLOT_CHOICES.map((m) => <option key={m} value={m}>{m} minutes</option>)}</Select>
              </Field>
              <p className="text-xs text-muted">Times are used only for special hours.</p>
              <Field label="Note (optional)"><Input name="note" placeholder="e.g. Conference" /></Field>
              <Button type="submit" variant="secondary" className="w-full"><Plus className="size-4" /> Add</Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
