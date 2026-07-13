import type { Ugx } from "./types";

export type { Ugx } from "./types";

export function ugx(value: number): Ugx {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Money must be whole UGX");
  }

  return value as Ugx;
}
