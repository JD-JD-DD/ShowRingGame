import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, storedHex] = passwordHash.split(":");

  if (!salt || !storedHex) return false;

  const derived = scryptSync(password, salt, KEY_LENGTH);
  const stored = Buffer.from(storedHex, "hex");

  if (derived.length !== stored.length) return false;

  return timingSafeEqual(derived, stored);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}