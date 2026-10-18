import { generateKeyBetween } from "fractional-indexing";

export function positionBetween(prev: string | null, next: string | null): string {
  return generateKeyBetween(prev, next);
}

export function positionsAfter(last: string | null, count: number): string[] {
  const out: string[] = [];
  let prev = last;
  for (let i = 0; i < count; i += 1) {
    const key = generateKeyBetween(prev, null);
    out.push(key);
    prev = key;
  }
  return out;
}
