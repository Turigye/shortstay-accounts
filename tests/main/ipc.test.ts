import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: { invoke: electron.invoke },
}));

import { registerIpcHandlers } from "../../src/main/ipc/register-handlers";
import { BusinessRepositoryError } from "../../src/main/db/repositories/business-repository";
import { BookingRepositoryError } from "../../src/main/db/repositories/booking-repository";
import { PaymentRepositoryError } from "../../src/main/db/repositories/payment-repository";
import { createStayBooksApi } from "../../src/preload";
import {
  IPC_CHANNELS,
  ipcRequestSchema,
  type IpcFailure,
} from "../../src/shared/ipc";

interface RegisteredHandler {
  (event: unknown, payload: unknown): Promise<unknown> | unknown;
}

function captureHandlers(): Map<string, RegisteredHandler> {
  const handlers = new Map<string, RegisteredHandler>();
  registerIpcHandlers({
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
  });
  return handlers;
}

beforeEach(() => {
  electron.invoke.mockReset();
});

describe("IPC contract", () => {
  it("uses a discriminated allowlist and rejects unknown keys", () => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.APP_READY,
        payload: {},
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({ channel: "database:query", payload: {} })
        .success,
    ).toBe(false);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.APP_READY,
        payload: { injected: true },
      }).success,
    ).toBe(false);
  });

  it("registers only named channels", () => {
    const handlers = captureHandlers();

    expect([...handlers.keys()]).toEqual([
      IPC_CHANNELS.APP_READY,
      IPC_CHANNELS.BUSINESS_STATUS,
      IPC_CHANNELS.BUSINESS_CREATE,
      IPC_CHANNELS.BUSINESS_UNLOCK,
      IPC_CHANNELS.BUSINESS_LOCK,
      IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
      IPC_CHANNELS.BUSINESS_SET_RATE,
      IPC_CHANNELS.CUSTOMERS_LIST,
      IPC_CHANNELS.CUSTOMER_CREATE,
      IPC_CHANNELS.CUSTOMER_UPDATE,
      IPC_CHANNELS.CUSTOMER_ARCHIVE,
      IPC_CHANNELS.BOOKINGS_LIST,
      IPC_CHANNELS.BOOKING_GET,
      IPC_CHANNELS.BOOKING_CREATE,
      IPC_CHANNELS.BOOKING_UPDATE,
      IPC_CHANNELS.BOOKING_TRANSITION,
      IPC_CHANNELS.BOOKING_ARCHIVE,
      IPC_CHANNELS.ACCOUNTS_LIST,
      IPC_CHANNELS.ACCOUNT_CREATE,
      IPC_CHANNELS.ACCOUNT_UPDATE,
      IPC_CHANNELS.ACCOUNT_ARCHIVE,
      IPC_CHANNELS.PAYMENTS_LIST,
      IPC_CHANNELS.PAYMENT_RECEIPT,
      IPC_CHANNELS.PAYMENT_REFUND,
      IPC_CHANNELS.PAYMENT_CORRECTION,
      IPC_CHANNELS.PAYMENT_REVERSE,
      IPC_CHANNELS.COMPENSATION_MONTHLY,
      IPC_CHANNELS.EXPENSES_LIST,
      IPC_CHANNELS.EXPENSE_CREATE,
      IPC_CHANNELS.SUPPLIERS_LIST,
      IPC_CHANNELS.SUPPLIER_CREATE,
      IPC_CHANNELS.SUPPLIER_PAYMENT,
      IPC_CHANNELS.RECURRING_EXPENSES_LIST,
      IPC_CHANNELS.RECURRING_EXPENSE_CREATE,
    ]);
    expect(handlers.has("database:query")).toBe(false);
  });

  it("accepts only canonical monthly compensation requests", () => {
    expect(ipcRequestSchema.safeParse({
      channel: IPC_CHANNELS.COMPENSATION_MONTHLY,
      payload: { month: "2026-07" },
    }).success).toBe(true);
    expect(ipcRequestSchema.safeParse({
      channel: IPC_CHANNELS.COMPENSATION_MONTHLY,
      payload: { month: "2026-7" },
    }).success).toBe(false);
  });

  it("returns structured field errors for invalid payloads", async () => {
    const handler = captureHandlers().get(IPC_CHANNELS.APP_READY);
    const result = (await handler?.(undefined, { injected: true })) as IpcFailure;

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "The request payload is invalid.",
      fieldErrors: {
        payload: [expect.stringContaining("injected")],
      },
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("sanitizes handler exceptions without leaking stack traces", async () => {
    const secret = "sensitive-database-path";
    const handlers = new Map<string, RegisteredHandler>();
    registerIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        },
      },
      {
        [IPC_CHANNELS.APP_READY]: () => {
          throw new Error(secret);
        },
      },
    );

    const result = await handlers.get(IPC_CHANNELS.APP_READY)?.(undefined, {});
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      fieldErrors: {},
    });
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("stack");
  });

  it("keeps create and unlock passwords inside strict named payloads", () => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_CREATE,
        payload: {
          name: "Client Business",
          unitNames: ["Unit 1", "Unit 2"],
          password: "long local password",
        },
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_UNLOCK,
        payload: { password: "wrong", databaseKey: "must-not-pass" },
      }).success,
    ).toBe(false);
  });

  it("accepts arbitrary non-empty unit lists after setup", () => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
        payload: {
          units: [
            { id: "unit-1", name: "Lake View" },
            { id: "unit-2", name: "Garden Suite" },
            { name: "Pool House" },
          ],
        },
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
        payload: { units: [] },
      }).success,
    ).toBe(false);
  });

  it("returns useful structured repository validation errors", async () => {
    const handlers = new Map<string, RegisteredHandler>();
    registerIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        },
      },
      {
        [IPC_CHANNELS.BUSINESS_SET_RATE]: () => {
          throw new BusinessRepositoryError(
            "VALIDATION_ERROR",
            "A reason is required for historical or closed-period changes.",
            {
              effectiveFrom: [
                "Enter a reason for this historical or closed period.",
              ],
            },
          );
        },
      },
    );

    expect(
      await handlers.get(IPC_CHANNELS.BUSINESS_SET_RATE)?.(undefined, {
        kind: "referral",
        value: 12,
        effectiveFrom: "2026-06-01",
      }),
    ).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "A reason is required for historical or closed-period changes.",
      fieldErrors: {
        effectiveFrom: ["Enter a reason for this historical or closed period."],
      },
    });
  });

  it("returns field validation for invalid rate values and calendar dates", async () => {
    const handler = captureHandlers().get(IPC_CHANNELS.BUSINESS_SET_RATE);
    const invalidPayloads = [
      {
        payload: { kind: "referral", value: 100.01, effectiveFrom: "2026-07-14" },
        field: "payload.value",
      },
      {
        payload: { kind: "referral", value: Number.POSITIVE_INFINITY, effectiveFrom: "2026-07-14" },
        field: "payload.value",
      },
      {
        payload: { kind: "taxProvision", value: 600_000.5, effectiveFrom: "2026-07-14" },
        field: "payload.value",
      },
      {
        payload: {
          kind: "taxProvision",
          value: Number.MAX_SAFE_INTEGER + 1,
          effectiveFrom: "2026-07-14",
        },
        field: "payload.value",
      },
      {
        payload: { kind: "taxProvision", value: 600_000, effectiveFrom: "2026-02-30" },
        field: "payload.effectiveFrom",
      },
    ] as const;

    for (const { payload, field } of invalidPayloads) {
      const result = (await handler?.(undefined, payload)) as IpcFailure;
      expect(result.code, JSON.stringify(payload)).toBe("VALIDATION_ERROR");
      expect(result.code).not.toBe("INTERNAL_ERROR");
      expect(result.fieldErrors[field]).toEqual([expect.any(String)]);
    }

    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_SET_RATE,
        payload: {
          kind: "referral",
          value: 10,
          effectiveFrom: "2028-02-29",
        },
      }).success,
    ).toBe(true);
  });

  it("returns field validation for duplicate initial unit names", async () => {
    const handler = captureHandlers().get(IPC_CHANNELS.BUSINESS_CREATE);
    const result = (await handler?.(undefined, {
      name: "Client Business",
      unitNames: ["Lake View", " lake view "],
      password: "long local password",
    })) as IpcFailure;

    expect(result.code).toBe("VALIDATION_ERROR");
    expect(result.fieldErrors["payload.unitNames.1"]).toEqual([
      expect.stringContaining("different"),
    ]);
  });

  it("accepts a complete initial receipt and rejects incomplete payment persistence", () => {
    const payload = {
      unitId: "unit-1",
      customerId: "customer-1",
      checkIn: "2026-07-20",
      checkOut: "2026-07-22",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      nightlyRate: 180_000,
      adjustment: -20_000,
      status: "confirmed",
      referred: true,
      referrerName: "Kato Travel",
      notes: "Late arrival",
    };

    expect(
      ipcRequestSchema.safeParse({ channel: IPC_CHANNELS.BOOKING_CREATE, payload }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BOOKING_CREATE,
        payload: {
          ...payload,
          initialPayment: {
            amount: 100_000,
            paidAt: "2026-07-14T09:30:00.000Z",
            method: "mobileMoney",
            accountId: "account-1",
            reference: "MM-4421",
          },
        },
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BOOKING_CREATE,
        payload: { ...payload, initialPayment: { amount: 100_000 } },
      }).success,
    ).toBe(false);
  });

  it("strictly validates payment accounts and movement commands", () => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.ACCOUNT_CREATE,
        payload: { name: "Main Mobile Money", type: "mobileMoney" },
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.ACCOUNT_CREATE,
        payload: { name: "Cheque Account", type: "cheque" },
      }).success,
    ).toBe(false);

    const receipt = {
      bookingId: "booking-1",
      amount: 100_000,
      paidAt: "2026-07-14T09:30:00.000Z",
      method: "bankTransfer",
      accountId: "account-1",
      reference: "BANK-1",
    };
    expect(
      ipcRequestSchema.safeParse({ channel: IPC_CHANNELS.PAYMENT_RECEIPT, payload: receipt })
        .success,
    ).toBe(true);

    for (const invalid of [
      { ...receipt, amount: 0 },
      { ...receipt, amount: 1.5 },
      { ...receipt, method: "cheque" },
      { ...receipt, paidAt: "2026-02-30T09:30:00.000Z" },
      { ...receipt, injected: true },
    ]) {
      expect(
        ipcRequestSchema.safeParse({
          channel: IPC_CHANNELS.PAYMENT_RECEIPT,
          payload: invalid,
        }).success,
      ).toBe(false);
    }

    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.PAYMENT_REFUND,
        payload: {
          ...receipt,
          additionalSettlement: true,
          reason: "Goodwill settlement",
        },
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.PAYMENT_REVERSE,
        payload: {
          paymentId: "payment-1",
          paidAt: "2026-07-15T09:30:00.000Z",
          reason: "Duplicate receipt",
        },
      }).success,
    ).toBe(true);
  });

  it("preserves structured payment repository errors", async () => {
    const handlers = new Map<string, RegisteredHandler>();
    registerIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        },
      },
      {
        [IPC_CHANNELS.PAYMENT_RECEIPT]: () => {
          throw new PaymentRepositoryError(
            "OVERPAYMENT_CONFIRMATION_REQUIRED",
            "This receipt would overpay the booking.",
            { confirmOverpayment: ["Confirm the overpayment."] },
          );
        },
      },
    );

    expect(
      await handlers.get(IPC_CHANNELS.PAYMENT_RECEIPT)?.(undefined, {
        bookingId: "booking-1",
        amount: 900_001,
        paidAt: "2026-07-14T09:30:00.000Z",
        method: "cash",
        accountId: "account-1",
      }),
    ).toEqual({
      ok: false,
      code: "OVERPAYMENT_CONFIRMATION_REQUIRED",
      message: "This receipt would overpay the booking.",
      fieldErrors: { confirmOverpayment: ["Confirm the overpayment."] },
    });
  });

  it.each([
    { referred: false, referrerName: "Kato Travel" },
    { referred: false, referrerId: "referrer-1" },
    { referred: true },
    { referred: true, referrerName: " " },
    { referrerName: "Kato Travel" },
    { referred: true, referrerId: "referrer-1", referrerName: "Kato Travel" },
  ])("rejects contradictory referral payloads: %#", (referral) => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BOOKING_CREATE,
        payload: {
          unitId: "unit-1",
          customerId: "customer-1",
          checkIn: "2026-07-20",
          checkOut: "2026-07-22",
          nightlyRate: 180_000,
          ...referral,
        },
      }).success,
    ).toBe(false);
  });

  it.each([
    { referred: false, referrerName: " " },
    { referred: true, referrerName: "Kato Travel" },
    { referred: true, referrerId: "referrer-1" },
  ])("accepts consistent referral payloads: %#", (referral) => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BOOKING_CREATE,
        payload: {
          unitId: "unit-1",
          customerId: "customer-1",
          checkIn: "2026-07-20",
          checkOut: "2026-07-22",
          nightlyRate: 180_000,
          ...referral,
        },
      }).success,
    ).toBe(true);
  });

  it("validates booking dates and whole-UGX amounts at the process boundary", async () => {
    const handler = captureHandlers().get(IPC_CHANNELS.BOOKING_CREATE);
    const base = {
      unitId: "unit-1",
      customerId: "customer-1",
      checkIn: "2026-07-20",
      checkOut: "2026-07-22",
      nightlyRate: 180_000,
    };

    for (const [field, payload] of [
      ["payload.checkOut", { ...base, checkOut: "2026-02-30" }],
      ["payload.nightlyRate", { ...base, nightlyRate: 180_000.5 }],
      ["payload.adjustment", { ...base, adjustment: Number.MAX_SAFE_INTEGER + 1 }],
    ] as const) {
      const result = (await handler?.(undefined, payload)) as IpcFailure;
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.fieldErrors[field]).toEqual([expect.any(String)]);
    }
  });

  it("returns overlap and transition errors without hiding their field guidance", async () => {
    const handlers = new Map<string, RegisteredHandler>();
    registerIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        },
      },
      {
        [IPC_CHANNELS.BOOKING_TRANSITION]: () => {
          throw new BookingRepositoryError(
            "INVALID_TRANSITION",
            "A completed booking cannot move to cancelled.",
            { status: ["This booking is already complete."] },
          );
        },
      },
    );

    expect(
      await handlers.get(IPC_CHANNELS.BOOKING_TRANSITION)?.(undefined, {
        id: "booking-1",
        status: "cancelled",
      }),
    ).toEqual({
      ok: false,
      code: "INVALID_TRANSITION",
      message: "A completed booking cannot move to cancelled.",
      fieldErrors: { status: ["This booking is already complete."] },
    });
  });
});

describe("preload API", () => {
  it("exposes only a frozen typed invoke capability", () => {
    const api = createStayBooksApi(vi.fn());

    expect(Object.keys(api)).toEqual(["invoke"]);
    expect(Object.isFrozen(api)).toBe(true);
    expect(electron.exposeInMainWorld).toHaveBeenCalledWith(
      "stayBooks",
      expect.objectContaining({ invoke: expect.any(Function) }),
    );
  });

  it("rejects invalid renderer input before it reaches Electron", async () => {
    const invoke = vi.fn();
    const api = createStayBooksApi(invoke);

    const result = await api.invoke(
      IPC_CHANNELS.APP_READY,
      { injected: true } as never,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { payload: expect.any(Array) },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("invokes a named channel and accepts only its validated response", async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      data: { ready: true },
    });
    const api = createStayBooksApi(invoke);

    await expect(api.invoke(IPC_CHANNELS.APP_READY, {})).resolves.toEqual({
      ok: true,
      data: { ready: true },
    });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_READY, {});

    invoke.mockResolvedValueOnce({ ok: true, data: { ready: true, extra: 1 } });
    await expect(api.invoke(IPC_CHANNELS.APP_READY, {})).resolves.toMatchObject({
      ok: false,
      code: "INVALID_RESPONSE",
    });
  });
});
