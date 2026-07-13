import { randomBytes } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomSegment(length: number): string {
  const bytes = randomBytes(length);
  let segment = "";
  for (let i = 0; i < length; i++) {
    segment += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return segment;
}

export function generateTrackingNumber(): string {
  return `PL-${randomSegment(4)}-${randomSegment(4)}`;
}