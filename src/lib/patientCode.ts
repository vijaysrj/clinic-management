import { randomInt } from "node:crypto";

// No 0/O, 1/I/L to avoid mix-ups when read over the phone or from paper.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generatePatientCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `PT-${s}`;
}

/** Normalise what a patient types: "pt 7k3m9q" -> "PT-7K3M9Q" */
export function normalizePatientCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.startsWith("PT") ? raw.slice(2) : raw;
  return `PT-${body}`;
}

/** Keep the last 10 digits of an Indian mobile number. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
