import { randomInt } from "node:crypto";

// No I, O, 0 or 1 – they are too easy to mix up when reading a code aloud.
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_LENGTH = 6;

export function generateInviteCode(nextInt: (max: number) => number = randomInt): string {
  let code = "";
  for (let i = 0; i < INVITE_LENGTH; i++) {
    code += INVITE_ALPHABET[nextInt(INVITE_ALPHABET.length)];
  }
  return code;
}

/** Accepts user input like "k7p-4qx" or "K7P 4QX" and returns "K7P4QX", or null if invalid. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== INVITE_LENGTH) return null;
  for (const char of code) {
    if (!INVITE_ALPHABET.includes(char)) return null;
  }
  return code;
}

/** "K7P4QX" → "K7P-4QX" */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
