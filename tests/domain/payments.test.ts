import { describe, expect, it } from "vitest";

import {
  PaymentRuleError,
  summarizeBookingBalance,
  validatePaymentDraft,
} from "../../src/domain/payments";
import { ugx } from "../../src/domain/money";

describe("booking payment balances", () => {
  it("summarizes installments and refunds from their append-only effects", () => {
    expect(
      summarizeBookingBalance(ugx(900_000), [
        { direction: "receipt", amount: ugx(300_000) },
        { direction: "receipt", amount: ugx(600_000) },
        { direction: "refund", amount: ugx(100_000) },
      ]),
    ).toEqual({
      received: 900_000,
      refunded: 100_000,
      netReceived: 800_000,
      due: 100_000,
      state: "partiallyPaid",
    });
  });

  it.each([
    ["unpaid", [], 0, 900_000],
    ["partiallyPaid", [{ direction: "receipt", amount: ugx(300_000) }], 300_000, 600_000],
    ["fullyPaid", [{ direction: "receipt", amount: ugx(900_000) }], 900_000, 0],
    ["overpaid", [{ direction: "receipt", amount: ugx(900_001) }], 900_001, 0],
    [
      "partiallyRefunded",
      [
        { direction: "receipt", amount: ugx(1_000_000) },
        { direction: "refund", amount: ugx(100_000) },
      ],
      900_000,
      0,
    ],
    [
      "fullyRefunded",
      [
        { direction: "receipt", amount: ugx(900_000) },
        { direction: "refund", amount: ugx(900_000) },
      ],
      0,
      900_000,
    ],
  ] as const)("returns the %s payment state", (state, movements, netReceived, due) => {
    expect(summarizeBookingBalance(ugx(900_000), movements)).toMatchObject({
      netReceived,
      due,
      state,
    });
  });

  it("counts reversal and correction records by their financial effect", () => {
    expect(
      summarizeBookingBalance(ugx(900_000), [
        { recordType: "receipt", direction: "receipt", amount: ugx(300_000) },
        { recordType: "reversal", direction: "refund", amount: ugx(300_000) },
        { recordType: "correction", direction: "receipt", amount: ugx(50_000) },
      ]),
    ).toEqual({
      received: 350_000,
      refunded: 300_000,
      netReceived: 50_000,
      due: 850_000,
      state: "partiallyPaid",
    });
  });

  it.each([
    () => summarizeBookingBalance(Number.MAX_SAFE_INTEGER + 1, []),
    () =>
      summarizeBookingBalance(ugx(1), [
        { direction: "receipt", amount: Number.MAX_SAFE_INTEGER },
        { direction: "receipt", amount: ugx(1) },
      ]),
    () =>
      summarizeBookingBalance(Number.MAX_SAFE_INTEGER, [
        { direction: "refund", amount: ugx(1) },
      ]),
  ])("rejects unsafe balance arithmetic", (summarize) => {
    expect(summarize).toThrow(PaymentRuleError);
  });
});

describe("payment movement validation", () => {
  it("accepts whole positive UGX with a date, supported method, and account", () => {
    expect(
      validatePaymentDraft({
        amount: 120_000,
        paidAt: "2026-07-14T09:30:00.000Z",
        method: "mobileMoney",
        accountId: "account-1",
        reference: "MM-4421",
      }),
    ).toEqual({
      amount: 120_000,
      paidAt: "2026-07-14T09:30:00.000Z",
      method: "mobileMoney",
      accountId: "account-1",
      reference: "MM-4421",
      note: null,
    });
  });

  it.each([
    [{ amount: 0 }, "amount"],
    [{ amount: 100.5 }, "amount"],
    [{ amount: Number.MAX_SAFE_INTEGER + 1 }, "amount"],
    [{ paidAt: "2026-02-30T09:30:00.000Z" }, "paidAt"],
    [{ paidAt: "" }, "paidAt"],
    [{ method: "cheque" }, "method"],
    [{ accountId: " " }, "accountId"],
  ] as const)("rejects invalid movement input %#", (override, field) => {
    expect(() =>
      validatePaymentDraft({
        amount: 120_000,
        paidAt: "2026-07-14T09:30:00.000Z",
        method: "cash",
        accountId: "account-1",
        ...override,
      } as Parameters<typeof validatePaymentDraft>[0]),
    ).toThrowError(
      expect.objectContaining<Partial<PaymentRuleError>>({
        fieldErrors: expect.objectContaining({ [field]: expect.any(Array) }),
      }),
    );
  });
});
