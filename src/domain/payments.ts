import type { BookingBalanceSummary, PaymentState, Ugx } from "./types";

export const PAYMENT_METHODS = ["cash", "mobileMoney", "bankTransfer", "card"] as const;
export const PAYMENT_RECORD_TYPES = ["receipt", "refund", "reversal", "correction"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentRecordType = (typeof PAYMENT_RECORD_TYPES)[number];
export type PaymentDirection = "receipt" | "refund";

export interface BalanceMovement {
  readonly direction: PaymentDirection;
  readonly amount: number;
  readonly recordType?: PaymentRecordType;
}

export interface PaymentDraft {
  readonly amount: number;
  readonly paidAt: string;
  readonly method: PaymentMethod;
  readonly accountId: string;
  readonly reference?: string | null;
  readonly note?: string | null;
}

export interface ValidPaymentDraft {
  readonly amount: Ugx;
  readonly paidAt: string;
  readonly method: PaymentMethod;
  readonly accountId: string;
  readonly reference: string | null;
  readonly note: string | null;
}

export class PaymentRuleError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super(message);
    this.name = "PaymentRuleError";
  }
}

function wholeUgx(value: number, field: string, options: { positive?: boolean } = {}): Ugx {
  if (!Number.isSafeInteger(value) || (options.positive ? value <= 0 : value < 0)) {
    throw new PaymentRuleError("Payment amounts must use whole UGX.", {
      [field]: [options.positive ? "Enter a whole UGX amount greater than zero." : "Enter a whole non-negative UGX amount."],
    });
  }
  return value as Ugx;
}

function checkedAdd(left: number, right: number): Ugx {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new PaymentRuleError("The payment balance is outside the supported UGX range.", {
      amount: ["Reduce the payment amounts."],
    });
  }
  return result as Ugx;
}

function optionalText(value: string | null | undefined, field: string): string | null {
  const trimmed = value?.trim() || null;
  if (trimmed && trimmed.length > 500) {
    throw new PaymentRuleError("Payment text is too long.", {
      [field]: ["Use 500 characters or fewer."],
    });
  }
  return trimmed;
}

function isIsoDateTime(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    calendarDate.getUTCFullYear() === Number(year) &&
    calendarDate.getUTCMonth() === Number(month) - 1 &&
    calendarDate.getUTCDate() === Number(day) &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

export function validatePaymentDraft(input: PaymentDraft): ValidPaymentDraft {
  const amount = wholeUgx(input.amount, "amount", { positive: true });
  if (!isIsoDateTime(input.paidAt)) {
    throw new PaymentRuleError("Enter a valid payment date and time.", {
      paidAt: ["Choose a valid payment date and time."],
    });
  }
  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new PaymentRuleError("Choose a supported payment method.", {
      method: ["Choose cash, mobile money, bank transfer, or card."],
    });
  }
  const accountId = input.accountId.trim();
  if (!accountId) {
    throw new PaymentRuleError("A payment account is required.", {
      accountId: ["Choose an active account."],
    });
  }
  return {
    amount,
    paidAt: input.paidAt,
    method: input.method,
    accountId,
    reference: optionalText(input.reference, "reference"),
    note: optionalText(input.note, "note"),
  };
}

function paymentState(total: number, received: number, refunded: number, net: number): PaymentState {
  if (received === 0 && refunded === 0) return "unpaid";
  if (refunded > 0 && net <= 0) return "fullyRefunded";
  if (net > total) return "overpaid";
  if (net < total) return "partiallyPaid";
  if (refunded > 0) return "partiallyRefunded";
  return "fullyPaid";
}

export function summarizeBookingBalance(
  totalInput: number,
  movements: readonly BalanceMovement[],
): BookingBalanceSummary {
  const total = wholeUgx(totalInput, "total");
  let received = 0 as Ugx;
  let refunded = 0 as Ugx;

  for (const movement of movements) {
    const amount = wholeUgx(movement.amount, "amount", { positive: true });
    if (movement.direction === "receipt") received = checkedAdd(received, amount);
    else if (movement.direction === "refund") refunded = checkedAdd(refunded, amount);
    else {
      throw new PaymentRuleError("The payment direction is invalid.", {
        direction: ["Use receipt or refund."],
      });
    }
  }

  const netReceived = received - refunded;
  if (!Number.isSafeInteger(netReceived)) {
    throw new PaymentRuleError("The payment balance is outside the supported UGX range.");
  }
  const rawDue = total - netReceived;
  if (!Number.isSafeInteger(rawDue)) {
    throw new PaymentRuleError("The payment balance is outside the supported UGX range.");
  }
  const due = Math.max(0, rawDue) as Ugx;

  return {
    received,
    refunded,
    netReceived: netReceived as Ugx,
    due,
    state: paymentState(total, received, refunded, netReceived),
  };
}
