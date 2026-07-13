import { describe, expect, it } from "vitest";

import { ugx } from "../../src/domain/money";

describe("ugx", () => {
  it("accepts whole safe UGX amounts", () => {
    expect(ugx(0)).toBe(0);
    expect(ugx(-1_200)).toBe(-1_200);
    expect(ugx(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([1_200.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects a non-whole or unsafe amount: %s",
    (amount) => {
      expect(() => ugx(amount)).toThrow("whole UGX");
    },
  );
});
