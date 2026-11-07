// Pure slot computation so it can be unit tested without a database.

export type Session = { startMin: number; endMin: number; slotMinutes: number };
export type Exception = { type: "leave" | "custom"; startMin: number | null; endMin: number | null; slotMinutes: number | null };
export type Slot = { startMin: number; endMin: number; tokenNo: number };

/** Sessions that apply on a date: exceptions override the weekly pattern. */
export function sessionsForDate(weekly: Session[], exceptions: Exception[]): Session[] {
  if (exceptions.some((e) => e.type === "leave")) return [];
  const custom = exceptions.filter(
    (e): e is Exception & { startMin: number; endMin: number; slotMinutes: number } =>
      e.type === "custom" && e.startMin != null && e.endMin != null && e.slotMinutes != null,
  );
  if (custom.length) return custom.map(({ startMin, endMin, slotMinutes }) => ({ startMin, endMin, slotMinutes }));
  return weekly;
}

/** All slots in a day, in time order, numbered 1..n as token numbers. */
export function buildSlots(sessions: Session[]): Slot[] {
  const slots: Omit<Slot, "tokenNo">[] = [];
  for (const s of [...sessions].sort((a, b) => a.startMin - b.startMin)) {
    if (s.slotMinutes <= 0) continue;
    for (let t = s.startMin; t + s.slotMinutes <= s.endMin; t += s.slotMinutes) {
      slots.push({ startMin: t, endMin: t + s.slotMinutes });
    }
  }
  // Drop overlaps if two sessions overlap.
  const out: Slot[] = [];
  let lastEnd = -1;
  for (const s of slots) {
    if (s.startMin < lastEnd) continue;
    out.push({ ...s, tokenNo: out.length + 1 });
    lastEnd = s.endMin;
  }
  return out;
}

export type SlotView = Slot & { available: boolean; past: boolean };

export function markSlots(slots: Slot[], takenStarts: Set<number>, nowMin: number | null): SlotView[] {
  return slots.map((s) => {
    const past = nowMin != null && s.startMin <= nowMin;
    return { ...s, past, available: !past && !takenStarts.has(s.startMin) };
  });
}
