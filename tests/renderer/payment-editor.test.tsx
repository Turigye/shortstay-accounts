// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "../../src/domain/bookings";
import type { Ugx } from "../../src/domain/types";
import type {
  PaymentAccount,
  PaymentMovement,
} from "../../src/main/db/repositories/payment-repository";
import { BookingBalance } from "../../src/renderer/components/BookingBalance";
import { PaymentEditor } from "../../src/renderer/components/PaymentEditor";
import { PaymentsScreen } from "../../src/renderer/screens/PaymentsScreen";
import { IPC_CHANNELS } from "../../src/shared/ipc";

const account: PaymentAccount = {
  id: "account-1",
  businessId: "business-1",
  name: "Main Mobile Money",
  type: "mobileMoney",
  currency: "UGX",
  archived: false,
  createdAt: "2026-07-14T09:00:00.000Z",
  updatedAt: "2026-07-14T09:00:00.000Z",
};

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    businessId: "business-1",
    unitId: "unit-1",
    unitName: "Lake View",
    customerId: "customer-1",
    customerName: "Amina N.",
    customerPhone: "+256 700 123456",
    customerEmail: null,
    referrerId: null,
    referrerName: null,
    checkIn: "2026-07-20",
    checkOut: "2026-07-25",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    nights: 5,
    nightlyRate: 180_000 as Ugx,
    adjustment: 0 as Ugx,
    total: 900_000 as Ugx,
    status: "confirmed",
    paymentState: "partiallyPaid",
    received: 800_000 as Ugx,
    refunded: 0 as Ugx,
    netReceived: 800_000 as Ugx,
    due: 100_000 as Ugx,
    balance: 100_000 as Ugx,
    notes: null,
    createdAt: "2026-07-14T09:00:00.000Z",
    updatedAt: "2026-07-14T09:00:00.000Z",
    ...overrides,
  };
}

function movement(overrides: Partial<PaymentMovement> = {}): PaymentMovement {
  return {
    id: "payment-1",
    businessId: "business-1",
    bookingId: "booking-1",
    customerName: "Amina N.",
    bookingTotal: 900_000 as Ugx,
    accountId: account.id,
    accountName: account.name,
    recordType: "receipt",
    direction: "receipt",
    amount: 300_000 as Ugx,
    paidAt: "2026-07-14T09:30:00.000Z",
    method: "mobileMoney",
    reference: "MM-4421",
    note: null,
    reversalOfId: null,
    correctionOfId: null,
    additionalSettlement: false,
    reason: null,
    createdAt: "2026-07-14T09:30:01.000Z",
    ...overrides,
  };
}

afterEach(cleanup);

describe("BookingBalance", () => {
  it("shows all balance totals and movements in payment-date order", () => {
    render(
      <BookingBalance
        booking={booking()}
        movements={[
          movement({
            id: "payment-2",
            direction: "refund",
            recordType: "refund",
            amount: 100_000 as Ugx,
            paidAt: "2026-07-16T10:00:00.000Z",
            reference: "MM-REF-1",
          }),
          movement(),
        ]}
      />,
    );

    const summary = screen.getByLabelText("Booking balance");
    for (const [label, value] of [
      ["Total", "UGX 900,000"],
      ["Received", "UGX 800,000"],
      ["Refunded", "UGX 0"],
      ["Net received", "UGX 800,000"],
      ["Due", "UGX 100,000"],
    ]) {
      const item = within(summary).getByText(label).parentElement;
      expect(item).toBeTruthy();
      expect(within(item!).getByText(value)).toBeTruthy();
    }
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("MM-4421");
    expect(items[1]?.textContent).toContain("MM-REF-1");
  });
});

describe("PaymentEditor", () => {
  it("requires an explicit warning confirmation before overpayment", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentEditor
        accounts={[account]}
        booking={booking()}
        mode="receipt"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Amount"), "200000");
    fireEvent.change(screen.getByLabelText("Payment date and time"), {
      target: { value: "2026-07-14T12:30" },
    });
    await user.click(screen.getByRole("button", { name: "Record receipt" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/overpay this booking by UGX 100,000/i)).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: /confirm overpayment/i }));
    await user.click(screen.getByRole("button", { name: "Record receipt" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "receipt",
        amount: 200_000,
        accountId: account.id,
        method: "mobileMoney",
        confirmOverpayment: true,
      }),
    );
  });

  it("requires explicit additional-settlement semantics and a nonblank reason", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <PaymentEditor
        accounts={[account]}
        booking={booking({ netReceived: 300_000 as Ugx, due: 600_000 as Ugx })}
        mode="refund"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Amount"), "350000");
    fireEvent.change(screen.getByLabelText("Payment date and time"), {
      target: { value: "2026-07-14T12:30" },
    });
    await user.click(screen.getByRole("button", { name: "Record refund" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText(/greater than the current net receipts/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("checkbox", { name: /additional settlement/i }));
    await user.click(screen.getByRole("button", { name: "Record refund" }));
    expect(screen.getByText(/explain the additional settlement/i)).toBeTruthy();
    await user.type(screen.getByLabelText("Reason"), "Goodwill settlement for interrupted stay");
    await user.click(screen.getByRole("button", { name: "Record refund" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "refund",
        amount: 350_000,
        additionalSettlement: true,
        reason: "Goodwill settlement for interrupted stay",
      }),
    );
  });

  it("recovers its busy state after a rejected submit and permits retry", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(undefined);
    render(
      <PaymentEditor
        accounts={[account]}
        booking={booking()}
        mode="receipt"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Amount"), "50000");
    fireEvent.change(screen.getByLabelText("Payment date and time"), {
      target: { value: "2026-07-14T12:30" },
    });
    await user.click(screen.getByRole("button", { name: "Record receipt" }));

    expect(await screen.findByText(/payment could not be recorded/i)).toBeTruthy();
    const retry = screen.getByRole<HTMLButtonElement>("button", { name: "Record receipt" });
    expect(retry.disabled).toBe(false);
    await user.click(retry);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });
});

describe("PaymentsScreen", () => {
  it("loads balances and recovers after a rejected receipt invoke", async () => {
    let receiptAttempts = 0;
    const saved = movement({ id: "payment-3", amount: 50_000 as Ugx });
    const invoke = vi.fn(async (channel: string) => {
      if (channel === IPC_CHANNELS.BOOKINGS_LIST) return { ok: true, data: [booking()] };
      if (channel === IPC_CHANNELS.ACCOUNTS_LIST) return { ok: true, data: [account] };
      if (channel === IPC_CHANNELS.PAYMENTS_LIST) return { ok: true, data: [movement()] };
      if (channel === IPC_CHANNELS.PAYMENT_RECEIPT) {
        receiptAttempts += 1;
        if (receiptAttempts === 1) throw new Error("database unavailable");
        return { ok: true, data: saved };
      }
      throw new Error(`Unexpected channel ${channel}`);
    });
    Object.defineProperty(window, "stayBooks", { configurable: true, value: { invoke } });
    render(<PaymentsScreen />);
    const user = userEvent.setup();

    expect(await screen.findByText("Amina N.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Accounts" }));
    expect(screen.getByLabelText("Payment accounts")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Record payment" }));
    expect(screen.queryByLabelText("Payment accounts")).toBeNull();
    await user.type(screen.getByLabelText("Amount"), "50000");
    fireEvent.change(screen.getByLabelText("Payment date and time"), {
      target: { value: "2026-07-14T12:30" },
    });
    await user.click(screen.getByRole("button", { name: "Record receipt" }));
    expect(await screen.findByText(/payment could not be recorded/i)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Record receipt" }).disabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Record receipt" }));
    await waitFor(() => expect(receiptAttempts).toBe(2));
  });
});
