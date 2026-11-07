"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, Star } from "lucide-react";
import { cx, inputClass } from "./ui";

export type MedicineHit = { id: number; brandName: string; composition: string | null; form: string | null; uses: number };

export function MedicineInput({
  value,
  onChange,
  onPick,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (m: MedicineHit) => void;
  autoFocus?: boolean;
}) {
  const [hits, setHits] = useState<MedicineHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || value.trim().length < 2) { setHits([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/medicines?q=${encodeURIComponent(value)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => { setHits(j.results ?? []); setActive(0); setOpen(true); })
        .catch(() => {});
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  const pick = (m: MedicineHit) => { typed.current = false; onPick(m); setOpen(false); };

  return (
    <div className="relative">
      <Pill className="pointer-events-none absolute top-3 left-3 size-4.5 text-muted" />
      <input
        autoFocus={autoFocus}
        className={cx(inputClass, "pl-9 font-medium")}
        // Keep browsers from offering saved contacts here: no "name" wording, autofill off.
        placeholder="Type a medicine or salt…"
        name="rx-drug-search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        value={value}
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(hits[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && hits.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-line bg-white p-1 shadow-xl">
          {hits.map((m, i) => (
            <li
              key={m.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setActive(i)}
              className={cx("cursor-pointer rounded-lg px-3 py-2", i === active && "bg-brand-50")}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.brandName}</span>
                {m.form && <span className="text-xs text-muted">{m.form}</span>}
                {m.uses > 0 && <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-700"><Star className="size-3 fill-current" /> {m.uses}</span>}
              </div>
              {m.composition && <div className="truncate text-xs text-muted">{m.composition}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
