"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Plus, Printer, Save, Trash2 } from "lucide-react";
import { MedicineInput } from "./MedicineInput";
import { Button, Card, ErrorNote, Field, Input, Textarea, cx } from "./ui";
import { savePadAction } from "@/app/staff/pad/actions";
import type { PadItem } from "@/lib/visits";

const DOSES = ["1-0-1", "1-0-0", "0-0-1", "1-1-1", "0-1-0", "SOS"];
const TIMINGS = ["After food", "Before food"];
const DURATIONS = ["3 days", "5 days", "7 days", "10 days", "15 days", "1 month"];

const emptyItem = (): PadItem => ({ medicineId: null, name: "", composition: null, dose: "1-0-1", timing: "After food", duration: "5 days", quantity: null, instructions: null });

function Chips({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cx("rounded-md border px-2 py-0.5 text-xs", value === o ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-muted hover:text-ink")}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function PadEditor({
  appointmentId,
  initial,
  lastItems,
}: {
  appointmentId: number;
  initial: { complaint: string; diagnosis: string; notes: string; advice: string; followUpDate: string | null; items: PadItem[] };
  lastItems: PadItem[] | null;
}) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [items, setItems] = useState<PadItem[]>(initial.items.length ? initial.items : [emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<PadItem>) => { setSaved(false); setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x))); };

  function save(print: boolean) {
    setError(null);
    start(async () => {
      const res = await savePadAction({ appointmentId, ...f, items });
      if (!res.ok) { setError(res.error); return; }
      setSaved(true);
      if (print) router.push(`/print/${res.visitId}?auto=1`);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Complaints">
            <Textarea rows={2} value={f.complaint} onChange={(e) => { setSaved(false); setF({ ...f, complaint: e.target.value }); }} placeholder="Fever for 3 days, body ache" />
          </Field>
          <Field label="Diagnosis">
            <Textarea rows={2} value={f.diagnosis} onChange={(e) => { setSaved(false); setF({ ...f, diagnosis: e.target.value }); }} placeholder="Viral fever" />
          </Field>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-brand-700">Examination notes (not printed)</summary>
          <Textarea className="mt-2" rows={2} value={f.notes} onChange={(e) => { setSaved(false); setF({ ...f, notes: e.target.value }); }} placeholder="BP 120/80, Temp 100.4°F" />
        </details>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="font-semibold">℞ Medicines</div>
          {lastItems && lastItems.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={() => { setSaved(false); setItems([...items.filter((i) => i.name.trim()), ...lastItems]); }}>
              <CopyPlus className="size-4" /> Repeat last prescription
            </Button>
          )}
        </div>
        <div className="divide-y divide-line">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 px-3 py-3">
              <div className="w-6 shrink-0 pt-3 text-center text-sm font-semibold text-muted">{i + 1}</div>
              <div className="min-w-0 flex-1 space-y-2">
                <MedicineInput
                  autoFocus={i === items.length - 1 && i > 0 && !it.name}
                  value={it.name}
                  onChange={(v) => update(i, { name: v, medicineId: null, composition: null })}
                  onPick={(m) => update(i, { name: m.brandName, medicineId: m.id, composition: m.composition })}
                />
                {it.composition && <div className="px-1 text-xs text-muted">{it.composition}</div>}
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Input className="h-9" value={it.dose ?? ""} onChange={(e) => update(i, { dose: e.target.value })} placeholder="Dose" />
                    <Chips options={DOSES} value={it.dose} onChange={(v) => update(i, { dose: v })} />
                  </div>
                  <div className="space-y-1">
                    <Input className="h-9" value={it.timing ?? ""} onChange={(e) => update(i, { timing: e.target.value })} placeholder="When" />
                    <Chips options={TIMINGS} value={it.timing} onChange={(v) => update(i, { timing: v })} />
                  </div>
                  <div className="space-y-1">
                    <Input className="h-9" value={it.duration ?? ""} onChange={(e) => update(i, { duration: e.target.value })} placeholder="Duration" />
                    <Chips options={DURATIONS} value={it.duration} onChange={(v) => update(i, { duration: v })} />
                  </div>
                </div>
                <Input className="h-9 text-sm" value={it.instructions ?? ""} onChange={(e) => update(i, { instructions: e.target.value })} placeholder="Instructions (optional), e.g. with warm water" />
              </div>
              <button type="button" aria-label="Remove medicine" onClick={() => { setSaved(false); setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [emptyItem()]); }} className="h-9 rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-700">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-line p-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => setItems([...items, emptyItem()])}><Plus className="size-4" /> Add medicine</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Field label="Advice">
            <Textarea rows={2} value={f.advice} onChange={(e) => { setSaved(false); setF({ ...f, advice: e.target.value }); }} placeholder="Drink plenty of fluids. Rest for 2 days." />
          </Field>
          <Field label="Follow-up on">
            <Input type="date" value={f.followUpDate ?? ""} onChange={(e) => { setSaved(false); setF({ ...f, followUpDate: e.target.value || null }); }} />
          </Field>
        </div>
      </Card>

      <ErrorNote>{error}</ErrorNote>
      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
        {saved && <span className="mr-auto self-center text-sm text-brand-700">Saved</span>}
        <Button type="button" variant="secondary" disabled={pending} onClick={() => save(false)}><Save className="size-4" /> Save</Button>
        <Button type="button" disabled={pending} onClick={() => save(true)}><Printer className="size-4" /> Save & print</Button>
      </div>
    </div>
  );
}
