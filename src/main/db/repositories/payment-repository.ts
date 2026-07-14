import type Database from "better-sqlite3-multiple-ciphers";

import {
  PaymentRuleError,
  summarizeBookingBalance,
  validatePaymentDraft,
  type PaymentDirection,
  type PaymentDraft,
  type PaymentMethod,
  type PaymentRecordType,
} from "../../../domain/payments";
import type { BookingBalanceSummary, Ugx } from "../../../domain/types";
import { createAuditRepository } from "./audit-repository";

export const PAYMENT_ACCOUNT_TYPES = ["cash", "bank", "mobileMoney", "card"] as const;
export type PaymentAccountType = (typeof PAYMENT_ACCOUNT_TYPES)[number];

export interface PaymentAccount {
  readonly id: string;
  readonly businessId: string;
  readonly name: string;
  readonly type: PaymentAccountType;
  readonly currency: "UGX";
  readonly archived: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaymentMovement {
  readonly id: string;
  readonly businessId: string;
  readonly bookingId: string;
  readonly customerName: string;
  readonly bookingTotal: Ugx;
  readonly accountId: string;
  readonly accountName: string;
  readonly recordType: PaymentRecordType;
  readonly direction: PaymentDirection;
  readonly amount: Ugx;
  readonly paidAt: string;
  readonly method: PaymentMethod;
  readonly reference: string | null;
  readonly note: string | null;
  readonly reversalOfId: string | null;
  readonly correctionOfId: string | null;
  readonly additionalSettlement: boolean;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface AccountInput {
  readonly name: string;
  readonly type: PaymentAccountType;
}

export interface ReceiptInput extends PaymentDraft {
  readonly bookingId: string;
  readonly confirmOverpayment?: boolean;
}

export interface RefundInput extends PaymentDraft {
  readonly bookingId: string;
  readonly additionalSettlement?: boolean;
  readonly reason?: string | null;
}

export interface CorrectionInput extends PaymentDraft {
  readonly bookingId: string;
  readonly originalPaymentId: string;
  readonly direction: PaymentDirection;
  readonly reason: string;
  readonly confirmOverpayment?: boolean;
  readonly additionalSettlement?: boolean;
}

export interface ReversalInput {
  readonly paymentId: string;
  readonly paidAt: string;
  readonly reason: string;
  readonly confirmOverpayment?: boolean;
}

export type InitialPaymentInput = Omit<ReceiptInput, "bookingId">;

export interface PaymentRepository {
  createAccount(input: AccountInput): PaymentAccount;
  updateAccount(id: string, input: AccountInput): PaymentAccount;
  archiveAccount(id: string): void;
  getAccount(id: string): PaymentAccount;
  listAccounts(): PaymentAccount[];
  recordReceipt(input: ReceiptInput): PaymentMovement;
  recordRefund(input: RefundInput): PaymentMovement;
  recordCorrection(input: CorrectionInput): PaymentMovement;
  reverseMovement(input: ReversalInput): PaymentMovement;
  getMovement(id: string): PaymentMovement;
  listMovements(filter?: { readonly bookingId?: string }): PaymentMovement[];
  getBookingBalance(bookingId: string): BookingBalanceSummary;
}

export class PaymentRepositoryError extends Error {
  constructor(
    readonly code:
      | "VALIDATION_ERROR"
      | "NOT_FOUND"
      | "CONFLICT"
      | "OVER_REFUND"
      | "OVERPAYMENT_CONFIRMATION_REQUIRED",
    message: string,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super(message);
    this.name = "PaymentRepositoryError";
  }
}

interface AccountRow {
  id: string;
  business_id: string;
  name: string;
  type: string;
  currency: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MovementRow {
  id: string;
  business_id: string;
  booking_id: string;
  customer_name: string;
  booking_total: number;
  account_id: string;
  account_name: string;
  record_type: string;
  direction: string;
  amount: number;
  paid_at: string;
  method: string;
  reference: string | null;
  note: string | null;
  reversal_of_id: string | null;
  correction_of_id: string | null;
  additional_settlement: number;
  reason: string | null;
  created_at: string;
}

const ACCOUNT_TYPE_TO_DATABASE: Readonly<Record<PaymentAccountType, string>> = {
  cash: "cash",
  bank: "bank",
  mobileMoney: "mobile_money",
  card: "card",
};

const ACCOUNT_TYPE_FROM_DATABASE: Readonly<Record<string, PaymentAccountType>> = {
  cash: "cash",
  bank: "bank",
  mobile_money: "mobileMoney",
  card: "card",
};

const METHOD_TO_DATABASE: Readonly<Record<PaymentMethod, string>> = {
  cash: "cash",
  mobileMoney: "mobile_money",
  bankTransfer: "bank_transfer",
  card: "card",
};

const METHOD_FROM_DATABASE: Readonly<Record<string, PaymentMethod>> = {
  cash: "cash",
  mobile_money: "mobileMoney",
  bank_transfer: "bankTransfer",
  card: "card",
};

function requiredText(value: string, field: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new PaymentRepositoryError("VALIDATION_ERROR", `${label} is required.`, {
      [field]: [`Enter ${label.toLocaleLowerCase()}.`],
    });
  }
  return trimmed;
}

function requireReason(value: string | null | undefined): string {
  const reason = value?.trim() || "";
  if (!reason) {
    throw new PaymentRepositoryError("VALIDATION_ERROR", "A reason is required.", {
      reason: ["Explain why this financial record is needed."],
    });
  }
  if (reason.length > 500) {
    throw new PaymentRepositoryError("VALIDATION_ERROR", "The reason is too long.", {
      reason: ["Use 500 characters or fewer."],
    });
  }
  return reason;
}

function asRepositoryValidation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof PaymentRuleError) {
      throw new PaymentRepositoryError("VALIDATION_ERROR", error.message, error.fieldErrors);
    }
    throw error;
  }
}

function accountFromRow(row: AccountRow): PaymentAccount {
  const type = ACCOUNT_TYPE_FROM_DATABASE[row.type];
  if (!type || row.currency !== "UGX") throw new Error("Unknown payment account data");
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    type,
    currency: "UGX",
    archived: row.archived_at !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function movementFromRow(row: MovementRow): PaymentMovement {
  const method = METHOD_FROM_DATABASE[row.method];
  if (!method) throw new Error(`Unknown payment method: ${row.method}`);
  if (row.direction !== "receipt" && row.direction !== "refund") {
    throw new Error(`Unknown payment direction: ${row.direction}`);
  }
  if (!["receipt", "refund", "reversal", "correction"].includes(row.record_type)) {
    throw new Error(`Unknown payment record type: ${row.record_type}`);
  }
  return {
    id: row.id,
    businessId: row.business_id,
    bookingId: row.booking_id,
    customerName: row.customer_name,
    bookingTotal: row.booking_total as Ugx,
    accountId: row.account_id,
    accountName: row.account_name,
    recordType: row.record_type as PaymentRecordType,
    direction: row.direction,
    amount: row.amount as Ugx,
    paidAt: row.paid_at,
    method,
    reference: row.reference,
    note: row.note,
    reversalOfId: row.reversal_of_id,
    correctionOfId: row.correction_of_id,
    additionalSettlement: row.additional_settlement === 1,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export function createPaymentRepository(
  database: Database.Database,
  businessId: string,
): PaymentRepository {
  const scopedBusinessId = requiredText(businessId, "businessId", "Business");
  const activeBusiness = database
    .prepare<[string], { id: string }>(
      "SELECT id FROM businesses WHERE id = ? AND archived_at IS NULL",
    )
    .get(scopedBusinessId);
  if (!activeBusiness) {
    throw new PaymentRepositoryError("NOT_FOUND", "The business is not available.", {
      businessId: ["Use an active local business."],
    });
  }
  const audit = createAuditRepository(database);
  const accountSelect = `
    SELECT id, business_id, name, type, currency, archived_at, created_at, updated_at
    FROM accounts
  `;
  const movementSelect = `
    SELECT
      p.id, p.business_id, p.booking_id, c.name AS customer_name,
      b.total_amount AS booking_total, p.account_id, a.name AS account_name,
      p.record_type, p.direction, p.amount, p.paid_at, p.method,
      p.reference, p.note, p.reversal_of_id,
      p.correction_of_id, p.additional_settlement, p.reason, p.created_at
    FROM payments p
    JOIN bookings b ON b.id = p.booking_id AND b.business_id = p.business_id
    JOIN customers c ON c.id = b.customer_id
    JOIN accounts a ON a.id = p.account_id AND a.business_id = p.business_id
  `;

  function getAccountRow(id: string, activeOnly = false): AccountRow {
    const row = database
      .prepare<[string, string], AccountRow>(`
        ${accountSelect}
        WHERE id = ? AND business_id = ? ${activeOnly ? "AND archived_at IS NULL" : ""}
      `)
      .get(id, scopedBusinessId);
    if (!row) {
      throw new PaymentRepositoryError("NOT_FOUND", "The payment account is not available.", {
        accountId: ["Choose an active account from this business."],
      });
    }
    return row;
  }

  function requireBooking(bookingId: string): { id: string; total: number } {
    const id = requiredText(bookingId, "bookingId", "Booking");
    const row = database
      .prepare<[string, string], { id: string; total: number }>(`
        SELECT id, total_amount AS total FROM bookings
        WHERE id = ? AND business_id = ? AND archived_at IS NULL
      `)
      .get(id, scopedBusinessId);
    if (!row) {
      throw new PaymentRepositoryError("NOT_FOUND", "The booking is not available.", {
        bookingId: ["Choose an active booking from this business."],
      });
    }
    return row;
  }

  function getMovementRow(id: string): MovementRow {
    const row = database
      .prepare<[string, string], MovementRow>(`
        ${movementSelect}
        WHERE p.id = ? AND p.business_id = ?
      `)
      .get(id, scopedBusinessId);
    if (!row) throw new PaymentRepositoryError("NOT_FOUND", "The payment movement was not found.");
    return row;
  }

  function listMovementRows(bookingId?: string): MovementRow[] {
    return bookingId
      ? database
          .prepare<[string, string], MovementRow>(`
            ${movementSelect}
            WHERE p.business_id = ? AND p.booking_id = ?
            ORDER BY p.paid_at, p.created_at, p.id
          `)
          .all(scopedBusinessId, bookingId)
      : database
          .prepare<[string], MovementRow>(`
            ${movementSelect}
            WHERE p.business_id = ?
            ORDER BY p.paid_at, p.created_at, p.id
          `)
          .all(scopedBusinessId);
  }

  function bookingBalance(bookingId: string): BookingBalanceSummary {
    const booking = requireBooking(bookingId);
    return asRepositoryValidation(() =>
      summarizeBookingBalance(
        booking.total,
        listMovementRows(booking.id).map(({ direction, amount, record_type }) => ({
          direction: direction as PaymentDirection,
          amount,
          recordType: record_type as PaymentRecordType,
        })),
      ),
    );
  }

  function insertMovement(input: {
    bookingId: string;
    recordType: PaymentRecordType;
    direction: PaymentDirection;
    draft: PaymentDraft;
    reason?: string | null;
    reversalOfId?: string | null;
    correctionOfId?: string | null;
    additionalSettlement?: boolean;
    confirmOverpayment?: boolean;
    bypassRefundLimit?: boolean;
  }): PaymentMovement {
    const draft = asRepositoryValidation(() => validatePaymentDraft(input.draft));
    const booking = requireBooking(input.bookingId);
    getAccountRow(draft.accountId, true);
    const before = bookingBalance(booking.id);
    const additionalSettlement = input.additionalSettlement === true;
    const reason = input.reason?.trim() || null;

    if (additionalSettlement && !reason) requireReason(input.reason);
    if (
      input.direction === "refund" &&
      !input.bypassRefundLimit &&
      draft.amount > before.netReceived &&
      !additionalSettlement
    ) {
      throw new PaymentRepositoryError(
        "OVER_REFUND",
        "This refund is greater than the booking's current net receipts.",
        { amount: ["Reduce the refund or record an explicit additional settlement with a reason."] },
      );
    }

    const after = asRepositoryValidation(() =>
      summarizeBookingBalance(booking.total, [
        ...listMovementRows(booking.id).map(({ direction, amount }) => ({
          direction: direction as PaymentDirection,
          amount,
        })),
        { direction: input.direction, amount: draft.amount },
      ]),
    );
    if (
      input.direction === "receipt" &&
      after.netReceived > booking.total &&
      input.confirmOverpayment !== true
    ) {
      throw new PaymentRepositoryError(
        "OVERPAYMENT_CONFIRMATION_REQUIRED",
        "This receipt would overpay the booking.",
        { confirmOverpayment: ["Confirm that the overpayment should be recorded."] },
      );
    }

    const inserted = database
      .prepare<{
        businessId: string;
        bookingId: string;
        accountId: string;
        recordType: PaymentRecordType;
        direction: PaymentDirection;
        amount: number;
        paidAt: string;
        method: string;
        reference: string | null;
        note: string | null;
        reversalOfId: string | null;
        correctionOfId: string | null;
        additionalSettlement: number;
        reason: string | null;
      }, { id: string }>(`
        INSERT INTO payments (
          business_id, booking_id, account_id, record_type, direction, amount,
          paid_at, method, reference, note,
          reversal_of_id, correction_of_id, additional_settlement, reason
        ) VALUES (
          @businessId, @bookingId, @accountId, @recordType, @direction, @amount,
          @paidAt, @method, @reference, @note,
          @reversalOfId, @correctionOfId, @additionalSettlement, @reason
        ) RETURNING id
      `)
      .get({
        businessId: scopedBusinessId,
        bookingId: booking.id,
        accountId: draft.accountId,
        recordType: input.recordType,
        direction: input.direction,
        amount: draft.amount,
        paidAt: draft.paidAt,
        method: METHOD_TO_DATABASE[draft.method],
        reference: draft.reference,
        note: draft.note,
        reversalOfId: input.reversalOfId ?? null,
        correctionOfId: input.correctionOfId ?? null,
        additionalSettlement: additionalSettlement ? 1 : 0,
        reason,
      });
    if (!inserted) throw new Error("Payment movement could not be created");
    const movement = movementFromRow(getMovementRow(inserted.id));
    audit.append({
      entityType: "payment",
      entityId: movement.id,
      action: input.recordType === "reversal" ? "reverse" : "create",
      reason: reason ?? undefined,
      after: movement,
    });
    return movement;
  }

  const repository: PaymentRepository = {
    createAccount(input) {
      const name = requiredText(input.name, "name", "Account name");
      if (!PAYMENT_ACCOUNT_TYPES.includes(input.type)) {
        throw new PaymentRepositoryError("VALIDATION_ERROR", "Choose a payment account type.", {
          type: ["Choose cash, bank, mobile money, or card."],
        });
      }
      return database.transaction(() => {
        const duplicate = database
          .prepare<[string, string], { id: string }>(
            "SELECT id FROM accounts WHERE business_id = ? AND lower(name) = lower(?)",
          )
          .get(scopedBusinessId, name);
        if (duplicate) {
          throw new PaymentRepositoryError("CONFLICT", "An account with this name already exists.", {
            name: ["Use a different account name."],
          });
        }
        const inserted = database
          .prepare<[string, string, string], AccountRow>(`
            INSERT INTO accounts (business_id, name, type)
            VALUES (?, ?, ?)
            RETURNING id, business_id, name, type, currency, archived_at, created_at, updated_at
          `)
          .get(scopedBusinessId, name, ACCOUNT_TYPE_TO_DATABASE[input.type]);
        if (!inserted) throw new Error("Payment account could not be created");
        const account = accountFromRow(inserted);
        audit.append({ entityType: "account", entityId: account.id, action: "create", after: account });
        return account;
      }).immediate();
    },

    updateAccount(id, input) {
      const name = requiredText(input.name, "name", "Account name");
      if (!PAYMENT_ACCOUNT_TYPES.includes(input.type)) {
        throw new PaymentRepositoryError("VALIDATION_ERROR", "Choose a payment account type.");
      }
      return database.transaction(() => {
        const before = accountFromRow(getAccountRow(id, true));
        const duplicate = database
          .prepare<[string, string, string], { id: string }>(
            "SELECT id FROM accounts WHERE business_id = ? AND lower(name) = lower(?) AND id <> ?",
          )
          .get(scopedBusinessId, name, id);
        if (duplicate) throw new PaymentRepositoryError("CONFLICT", "An account with this name already exists.");
        database
          .prepare("UPDATE accounts SET name = ?, type = ? WHERE id = ? AND business_id = ? AND archived_at IS NULL")
          .run(name, ACCOUNT_TYPE_TO_DATABASE[input.type], id, scopedBusinessId);
        const after = accountFromRow(getAccountRow(id, true));
        audit.append({ entityType: "account", entityId: id, action: "update", before, after });
        return after;
      }).immediate();
    },

    archiveAccount(id) {
      database.transaction(() => {
        const before = accountFromRow(getAccountRow(id, true));
        database
          .prepare("UPDATE accounts SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND business_id = ? AND archived_at IS NULL")
          .run(id, scopedBusinessId);
        const after = accountFromRow(getAccountRow(id));
        audit.append({ entityType: "account", entityId: id, action: "update", before, after });
      }).immediate();
    },

    getAccount(id) {
      return accountFromRow(getAccountRow(id));
    },

    listAccounts() {
      return database
        .prepare<[string], AccountRow>(`
          ${accountSelect}
          WHERE business_id = ? AND archived_at IS NULL
          ORDER BY lower(name), created_at, id
        `)
        .all(scopedBusinessId)
        .map(accountFromRow);
    },

    recordReceipt(input) {
      return database.transaction(() =>
        insertMovement({
          bookingId: input.bookingId,
          recordType: "receipt",
          direction: "receipt",
          draft: input,
          confirmOverpayment: input.confirmOverpayment,
        }),
      ).immediate();
    },

    recordRefund(input) {
      return database.transaction(() =>
        insertMovement({
          bookingId: input.bookingId,
          recordType: "refund",
          direction: "refund",
          draft: input,
          reason: input.reason,
          additionalSettlement: input.additionalSettlement,
        }),
      ).immediate();
    },

    recordCorrection(input) {
      const reason = requireReason(input.reason);
      return database.transaction(() => {
        const original = movementFromRow(getMovementRow(input.originalPaymentId));
        if (original.bookingId !== input.bookingId) {
          throw new PaymentRepositoryError("VALIDATION_ERROR", "The correction must use the original booking.", {
            bookingId: ["Use the booking linked to the original movement."],
          });
        }
        return insertMovement({
          bookingId: input.bookingId,
          recordType: "correction",
          direction: input.direction,
          draft: input,
          reason,
          correctionOfId: original.id,
          confirmOverpayment: input.confirmOverpayment,
          additionalSettlement: input.additionalSettlement,
        });
      }).immediate();
    },

    reverseMovement(input) {
      const reason = requireReason(input.reason);
      return database.transaction(() => {
        const original = movementFromRow(getMovementRow(input.paymentId));
        if (original.recordType === "reversal") {
          throw new PaymentRepositoryError("VALIDATION_ERROR", "A reversal cannot itself be reversed.");
        }
        const existing = database
          .prepare<[string, string], { id: string }>(
            "SELECT id FROM payments WHERE business_id = ? AND reversal_of_id = ?",
          )
          .get(scopedBusinessId, original.id);
        if (existing) {
          throw new PaymentRepositoryError("CONFLICT", "This movement has already been reversed.", {
            paymentId: ["Each original movement can be reversed only once."],
          });
        }
        return insertMovement({
          bookingId: original.bookingId,
          recordType: "reversal",
          direction: original.direction === "receipt" ? "refund" : "receipt",
          draft: {
            amount: original.amount,
            paidAt: input.paidAt,
            method: original.method,
            accountId: original.accountId,
            reference: original.reference,
            note: null,
          },
          reason,
          reversalOfId: original.id,
          confirmOverpayment: input.confirmOverpayment,
          bypassRefundLimit: true,
        });
      }).immediate();
    },

    getMovement(id) {
      return movementFromRow(getMovementRow(id));
    },

    listMovements(filter = {}) {
      if (filter.bookingId) requireBooking(filter.bookingId);
      return listMovementRows(filter.bookingId).map(movementFromRow);
    },

    getBookingBalance(bookingId) {
      return bookingBalance(bookingId);
    },
  };

  return Object.freeze(repository);
}
