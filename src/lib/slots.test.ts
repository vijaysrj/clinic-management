import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSlots, markSlots, sessionsForDate } from "./slots";
import { normalizePatientCode, normalizePhone, generatePatientCode } from "./patientCode";

test("builds 10-minute slots across two sessions with running token numbers", () => {
  const slots = buildSlots([
    { startMin: 17 * 60, endMin: 17 * 60 + 30, slotMinutes: 10 },
    { startMin: 9 * 60, endMin: 9 * 60 + 25, slotMinutes: 10 },
  ]);
  assert.deepEqual(slots.map((s) => [s.startMin, s.tokenNo]), [
    [540, 1], [550, 2], [1020, 3], [1030, 4], [1040, 5],
  ]);
});

test("leave removes the day, custom replaces the weekly pattern", () => {
  const weekly = [{ startMin: 540, endMin: 600, slotMinutes: 5 }];
  assert.deepEqual(sessionsForDate(weekly, [{ type: "leave", startMin: null, endMin: null, slotMinutes: null }]), []);
  assert.deepEqual(sessionsForDate(weekly, [{ type: "custom", startMin: 600, endMin: 660, slotMinutes: 15 }]), [
    { startMin: 600, endMin: 660, slotMinutes: 15 },
  ]);
  assert.deepEqual(sessionsForDate(weekly, []), weekly);
});

test("past and taken slots are unavailable", () => {
  const slots = buildSlots([{ startMin: 540, endMin: 570, slotMinutes: 10 }]);
  const v = markSlots(slots, new Set([560]), 545);
  assert.deepEqual(v.map((s) => s.available), [false, true, false]);
});

test("patient code and phone normalisation", () => {
  assert.equal(normalizePatientCode(" pt 7k3m9q"), "PT-7K3M9Q");
  assert.equal(normalizePatientCode("7K3M9Q"), "PT-7K3M9Q");
  assert.equal(normalizePhone("+91 98765-43210"), "9876543210");
  assert.match(generatePatientCode(), /^PT-[2-9A-HJKMNP-Z]{6}$/);
});
