import type Database from "better-sqlite3-multiple-ciphers";

import {
  BookingRuleError,
  assertBookingTransition,
  calculateBookingTotal,
  calculateNights,
  occupiesUnit,
  type Booking,
  type Customer,
} from "../../../domain/bookings";
import type { BookingStatus, Ugx } from "../../../domain/types";
import { createAuditRepository } from "./audit-repository";

export interface CustomerInput {
  readonly name: string;
  readonly phone: string;
  readonly email?: string | null;
  readonly notes?: string | null;
}

export interface BookingInput {
  readonly unitId: string;
  readonly customerId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly checkInTime?: string;
  readonly checkOutTime?: string;
  readonly nightlyRate: number;
  readonly adjustment?: number;
  readonly status?: BookingStatus;
  readonly referred?: boolean;
  readonly referrerId?: string | null;
  readonly referrerName?: string | null;
  readonly notes?: string | null;
}

export interface BookingListFilter {
  readonly status?: BookingStatus;
  readonly unitId?: string;
  readonly customerId?: string;
  readonly query?: string;
  readonly scheduleFrom?: string;
  readonly scheduleTo?: string;
  readonly balance?: "unpaid" | "outstanding" | "paid";
}

export interface BookingRepository {
  createCustomer(input: CustomerInput): Customer;
  updateCustomer(id: string, input: CustomerInput): Customer;
  archiveCustomer(id: string): void;
  getCustomer(id: string): Customer;
  listCustomers(): Customer[];
  createBooking(input: BookingInput): Booking;
  updateBooking(id: string, input: BookingInput): Booking;
  transitionBooking(id: string, to: BookingStatus): Booking;
  archiveBooking(id: string): void;
  getBooking(id: string): Booking;
  listBookings(filter?: BookingListFilter): Booking[];
}

export class BookingRepositoryError extends Error {
  constructor(
    readonly code: "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND" | "INVALID_TRANSITION",
    message: string,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super(message);
    this.name = "BookingRepositoryError";
  }
}

interface CustomerRow {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  archived_at: string | null;
}

interface BookingRow {
  id: string;
  business_id: string;
  unit_id: string;
  unit_name: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  referrer_id: string | null;
  referrer_name: string | null;
  check_in: string;
  check_out: string;
  check_in_time: string;
  check_out_time: string;
  nightly_rate: number;
  adjustment: number;
  total_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  received: number;
  refunded: number;
}

const STATUS_TO_DATABASE: Readonly<Record<BookingStatus, string>> = {
  draft: "draft",
  confirmed: "confirmed",
  checkedIn: "checked_in",
  completed: "completed",
  cancelled: "cancelled",
};

const STATUS_FROM_DATABASE: Readonly<Record<string, BookingStatus>> = {
  draft: "draft",
  confirmed: "confirmed",
  checked_in: "checkedIn",
  completed: "completed",
  cancelled: "cancelled",
};

function requiredText(value: string, field: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BookingRepositoryError("VALIDATION_ERROR", `${label} is required.`, {
      [field]: [`Enter ${label.toLocaleLowerCase()}.`],
    });
  }
  return trimmed;
}

function optionalText(value: string | null | undefined, maximum: number): string | null {
  const trimmed = value?.trim() || null;
  if (trimmed && trimmed.length > maximum) {
    throw new BookingRepositoryError("VALIDATION_ERROR", "Entered text is too long.");
  }
  return trimmed;
}

function validateCustomer(input: CustomerInput): Required<CustomerInput> {
  const fieldErrors: Record<string, string[]> = {};
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name) fieldErrors.name = ["Enter the customer's name."];
  if (!phone) fieldErrors.phone = ["Enter the customer's phone number."];
  const email = optionalText(input.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = ["Enter a valid email address or leave it blank."];
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new BookingRepositoryError(
      "VALIDATION_ERROR",
      "Check the customer details.",
      fieldErrors,
    );
  }
  return { name, phone, email, notes: optionalText(input.notes, 2_000) };
}

function validateTime(value: string | undefined, fallback: string, field: string): string {
  const time = value ?? fallback;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new BookingRepositoryError("VALIDATION_ERROR", "Enter a valid stay time.", {
      [field]: ["Enter a time between 00:00 and 23:59."],
    });
  }
  return time;
}

function asRepositoryValidation(error: unknown): never {
  if (error instanceof BookingRuleError) {
    throw new BookingRepositoryError(
      "VALIDATION_ERROR",
      error.message,
      error.fieldErrors,
    );
  }
  throw error;
}

function customerFromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone ?? "",
    email: row.email,
    notes: row.notes,
    archived: row.archived_at !== null,
  };
}

function bookingFromRow(row: BookingRow): Booking {
  const status = STATUS_FROM_DATABASE[row.status];
  if (!status) throw new Error(`Unknown booking status: ${row.status}`);
  const nights = calculateNights({ checkIn: row.check_in, checkOut: row.check_out });
  const netReceived = row.received - row.refunded;
  const balance = row.total_amount - netReceived;
  const paymentState =
    netReceived <= 0
      ? "unpaid"
      : balance > 0
        ? "partiallyPaid"
        : balance === 0
          ? "fullyPaid"
          : "overpaid";
  return {
    id: row.id,
    businessId: row.business_id,
    unitId: row.unit_id,
    unitName: row.unit_name,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? "",
    customerEmail: row.customer_email,
    referrerId: row.referrer_id,
    referrerName: row.referrer_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    nights,
    nightlyRate: row.nightly_rate as Ugx,
    adjustment: row.adjustment as Ugx,
    total: row.total_amount as Ugx,
    status,
    paymentState,
    received: netReceived as Ugx,
    balance: balance as Ugx,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createBookingRepository(
  database: Database.Database,
  businessId: string,
): BookingRepository {
  const scopedBusinessId = requiredText(businessId, "businessId", "Business");
  const audit = createAuditRepository(database);

  const bookingSelect = `
    SELECT
      b.id, b.business_id, b.unit_id, u.name AS unit_name,
      b.customer_id, c.name AS customer_name, c.phone AS customer_phone,
      c.email AS customer_email, b.referrer_id, r.name AS referrer_name,
      b.check_in, b.check_out, b.check_in_time, b.check_out_time,
      b.nightly_rate, b.adjustment, b.total_amount, b.status, b.notes,
      b.created_at, b.updated_at,
      COALESCE(SUM(CASE WHEN p.direction = 'receipt' THEN p.amount ELSE 0 END), 0) AS received,
      COALESCE(SUM(CASE WHEN p.direction = 'refund' THEN p.amount ELSE 0 END), 0) AS refunded
    FROM bookings b
    JOIN units u ON u.id = b.unit_id
    JOIN customers c ON c.id = b.customer_id
    LEFT JOIN referrers r ON r.id = b.referrer_id
    LEFT JOIN payments p ON p.booking_id = b.id AND p.business_id = b.business_id
  `;

  function getCustomerRow(id: string, includeArchived = true): CustomerRow {
    const row = database
      .prepare<[string, string], CustomerRow>(`
        SELECT id, business_id, name, phone, email, notes, archived_at
        FROM customers
        WHERE id = ? AND business_id = ? ${includeArchived ? "" : "AND archived_at IS NULL"}
      `)
      .get(id, scopedBusinessId);
    if (!row) {
      throw new BookingRepositoryError("NOT_FOUND", "The customer is not available.", {
        customerId: ["Choose an active customer from this business."],
      });
    }
    return row;
  }

  function getBookingRow(id: string): BookingRow {
    const row = database
      .prepare<[string, string], BookingRow>(`
        ${bookingSelect}
        WHERE b.id = ? AND b.business_id = ? AND b.archived_at IS NULL
        GROUP BY b.id
      `)
      .get(id, scopedBusinessId);
    if (!row) throw new BookingRepositoryError("NOT_FOUND", "The booking was not found.");
    return row;
  }

  function requireUnit(unitId: string): string {
    const row = database
      .prepare<[string, string], { name: string }>(`
        SELECT name FROM units
        WHERE id = ? AND business_id = ? AND status = 'active' AND archived_at IS NULL
      `)
      .get(unitId, scopedBusinessId);
    if (!row) {
      throw new BookingRepositoryError("NOT_FOUND", "The unit is not available.", {
        unitId: ["Choose an active unit from this business."],
      });
    }
    return row.name;
  }

  function requireNoOverlap(
    unitId: string,
    checkIn: string,
    checkOut: string,
    status: BookingStatus,
    excludeId: string | null = null,
  ): void {
    if (!occupiesUnit(status)) return;
    const conflict = database
      .prepare<{
        businessId: string;
        unitId: string;
        checkIn: string;
        checkOut: string;
        excludeId: string | null;
      }, { id: string; unit_name: string }>(`
        SELECT b.id, u.name AS unit_name
        FROM bookings b
        JOIN units u ON u.id = b.unit_id
        WHERE b.business_id = @businessId
          AND b.unit_id = @unitId
          AND b.archived_at IS NULL
          AND b.status IN ('confirmed', 'checked_in', 'completed')
          AND b.check_in < @checkOut
          AND @checkIn < b.check_out
          AND (@excludeId IS NULL OR b.id <> @excludeId)
        LIMIT 1
      `)
      .get({ businessId: scopedBusinessId, unitId, checkIn, checkOut, excludeId });
    if (conflict) {
      throw new BookingRepositoryError(
        "CONFLICT",
        `${conflict.unit_name} already has a booking in this date range.`,
        { dates: [`Choose dates that are available for ${conflict.unit_name}.`] },
      );
    }
  }

  function resolveReferrer(input: BookingInput): string | null {
    const hasReferrerId = Boolean(input.referrerId);
    const referrerName = input.referrerName?.trim() || null;
    const hasReferrerName = referrerName !== null;

    if (input.referred !== true) {
      const fieldErrors: Record<string, string[]> = {};
      if (hasReferrerId) {
        fieldErrors.referrerId = [
          "Remove the referrer ID or mark this as a referral booking.",
        ];
      }
      if (hasReferrerName) {
        fieldErrors.referrerName = [
          "Remove the referrer name or mark this as a referral booking.",
        ];
      }
      if (Object.keys(fieldErrors).length > 0) {
        throw new BookingRepositoryError(
          "VALIDATION_ERROR",
          "Referral details contradict the booking referral choice.",
          fieldErrors,
        );
      }
      return null;
    }

    if (hasReferrerId === hasReferrerName) {
      throw new BookingRepositoryError(
        "VALIDATION_ERROR",
        hasReferrerId
          ? "Choose an existing referrer or enter a new name, not both."
          : "A referrer is required.",
        {
          referrerName: [
            hasReferrerId
              ? "Remove the new name when choosing an existing referrer."
              : "Enter who referred this booking.",
          ],
        },
      );
    }

    if (input.referrerId) {
      const row = database
        .prepare<[string, string], { id: string }>(`
          SELECT id FROM referrers
          WHERE id = ? AND business_id = ? AND archived_at IS NULL
        `)
        .get(input.referrerId, scopedBusinessId);
      if (!row) {
        throw new BookingRepositoryError("NOT_FOUND", "The referrer is not available.", {
          referrerId: ["Choose an active referrer from this business."],
        });
      }
      return row.id;
    }
    const existing = database
      .prepare<[string, string], { id: string }>(`
        SELECT id FROM referrers
        WHERE business_id = ? AND lower(name) = lower(?) AND archived_at IS NULL
        ORDER BY created_at LIMIT 1
      `)
      .get(scopedBusinessId, referrerName!);
    if (existing) return existing.id;
    const inserted = database
      .prepare<[string, string], { id: string }>(
        "INSERT INTO referrers (business_id, name) VALUES (?, ?) RETURNING id",
      )
      .get(scopedBusinessId, referrerName!);
    if (!inserted) throw new Error("Referrer could not be created");
    return inserted.id;
  }

  function normalizeBooking(input: BookingInput, status: BookingStatus) {
    const unitId = requiredText(input.unitId, "unitId", "Unit");
    const customerId = requiredText(input.customerId, "customerId", "Customer");
    const checkIn = input.checkIn;
    const checkOut = input.checkOut;
    let nights: number;
    let total: Ugx;
    try {
      nights = calculateNights({ checkIn, checkOut });
      total = calculateBookingTotal({
        nights,
        nightlyRate: input.nightlyRate,
        adjustment: input.adjustment ?? 0,
      });
    } catch (error) {
      asRepositoryValidation(error);
    }
    return {
      unitId,
      customerId,
      checkIn,
      checkOut,
      checkInTime: validateTime(input.checkInTime, "14:00", "checkInTime"),
      checkOutTime: validateTime(input.checkOutTime, "11:00", "checkOutTime"),
      nightlyRate: input.nightlyRate,
      adjustment: input.adjustment ?? 0,
      total: total!,
      status,
      notes: optionalText(input.notes, 2_000),
    };
  }

  const repository: BookingRepository = {
    createCustomer(input) {
      const customer = validateCustomer(input);
      return database.transaction(() => {
        const inserted = database
          .prepare<{
            businessId: string;
            name: string;
            phone: string;
            email: string | null;
            notes: string | null;
          }, CustomerRow>(`
            INSERT INTO customers (business_id, name, phone, email, notes)
            VALUES (@businessId, @name, @phone, @email, @notes)
            RETURNING id, business_id, name, phone, email, notes, archived_at
          `)
          .get({ businessId: scopedBusinessId, ...customer });
        if (!inserted) throw new Error("Customer could not be created");
        const result = customerFromRow(inserted);
        audit.append({ entityType: "customer", entityId: result.id, action: "create", after: result });
        return result;
      }).immediate();
    },

    updateCustomer(id, input) {
      const customer = validateCustomer(input);
      return database.transaction(() => {
        const before = customerFromRow(getCustomerRow(id, false));
        database.prepare(`
          UPDATE customers SET name = @name, phone = @phone, email = @email, notes = @notes
          WHERE id = @id AND business_id = @businessId AND archived_at IS NULL
        `).run({ id, businessId: scopedBusinessId, ...customer });
        const after = customerFromRow(getCustomerRow(id, false));
        audit.append({ entityType: "customer", entityId: id, action: "update", before, after });
        return after;
      }).immediate();
    },

    archiveCustomer(id) {
      database.transaction(() => {
        const before = customerFromRow(getCustomerRow(id, false));
        database
          .prepare("UPDATE customers SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND business_id = ?")
          .run(id, scopedBusinessId);
        const after = customerFromRow(getCustomerRow(id));
        audit.append({ entityType: "customer", entityId: id, action: "update", before, after });
      }).immediate();
    },

    getCustomer(id) {
      return customerFromRow(getCustomerRow(id));
    },

    listCustomers() {
      return database
        .prepare<[string], CustomerRow>(`
          SELECT id, business_id, name, phone, email, notes, archived_at
          FROM customers
          WHERE business_id = ? AND archived_at IS NULL
          ORDER BY lower(name), created_at, id
        `)
        .all(scopedBusinessId)
        .map(customerFromRow);
    },

    createBooking(input) {
      const status = input.status ?? "confirmed";
      if (status !== "draft" && status !== "confirmed") {
        throw new BookingRepositoryError(
          "INVALID_TRANSITION",
          "A new booking must start as draft or confirmed.",
          { status: ["Start the booking as Draft or Confirmed."] },
        );
      }
      const normalized = normalizeBooking(input, status);
      return database.transaction(() => {
        requireUnit(normalized.unitId);
        getCustomerRow(normalized.customerId, false);
        const referrerId = resolveReferrer(input);
        requireNoOverlap(
          normalized.unitId,
          normalized.checkIn,
          normalized.checkOut,
          normalized.status,
        );
        const inserted = database
          .prepare<{
            businessId: string;
            unitId: string;
            customerId: string;
            referrerId: string | null;
            checkIn: string;
            checkOut: string;
            checkInTime: string;
            checkOutTime: string;
            nightlyRate: number;
            adjustment: number;
            total: number;
            status: string;
            notes: string | null;
          }, { id: string }>(`
            INSERT INTO bookings (
              business_id, unit_id, customer_id, referrer_id, check_in, check_out,
              check_in_time, check_out_time, nightly_rate, adjustment, total_amount,
              status, notes
            ) VALUES (
              @businessId, @unitId, @customerId, @referrerId, @checkIn, @checkOut,
              @checkInTime, @checkOutTime, @nightlyRate, @adjustment, @total,
              @status, @notes
            ) RETURNING id
          `)
          .get({
            businessId: scopedBusinessId,
            ...normalized,
            referrerId,
            status: STATUS_TO_DATABASE[status],
          });
        if (!inserted) throw new Error("Booking could not be created");
        const result = bookingFromRow(getBookingRow(inserted.id));
        audit.append({ entityType: "booking", entityId: result.id, action: "create", after: result });
        return result;
      }).immediate();
    },

    updateBooking(id, input) {
      return database.transaction(() => {
        const before = bookingFromRow(getBookingRow(id));
        if (before.status === "completed" || before.status === "cancelled") {
          throw new BookingRepositoryError(
            "INVALID_TRANSITION",
            "Completed or cancelled bookings cannot be edited.",
          );
        }
        if (input.status && input.status !== before.status) {
          throw new BookingRepositoryError(
            "INVALID_TRANSITION",
            "Change booking status with a status action.",
            { status: ["Use the available booking status action."] },
          );
        }
        const normalized = normalizeBooking(input, before.status);
        requireUnit(normalized.unitId);
        getCustomerRow(normalized.customerId, false);
        const referrerId = resolveReferrer(input);
        requireNoOverlap(
          normalized.unitId,
          normalized.checkIn,
          normalized.checkOut,
          before.status,
          id,
        );
        database.prepare(`
          UPDATE bookings SET
            unit_id = @unitId, customer_id = @customerId, referrer_id = @referrerId,
            check_in = @checkIn, check_out = @checkOut,
            check_in_time = @checkInTime, check_out_time = @checkOutTime,
            nightly_rate = @nightlyRate, adjustment = @adjustment,
            total_amount = @total, notes = @notes
          WHERE id = @id AND business_id = @businessId AND archived_at IS NULL
        `).run({ id, businessId: scopedBusinessId, ...normalized, referrerId });
        const after = bookingFromRow(getBookingRow(id));
        audit.append({ entityType: "booking", entityId: id, action: "update", before, after });
        return after;
      }).immediate();
    },

    transitionBooking(id, to) {
      return database.transaction(() => {
        const before = bookingFromRow(getBookingRow(id));
        try {
          assertBookingTransition(before.status, to);
        } catch (error) {
          if (error instanceof BookingRuleError) {
            throw new BookingRepositoryError(
              "INVALID_TRANSITION",
              error.message,
              error.fieldErrors,
            );
          }
          throw error;
        }
        requireNoOverlap(before.unitId, before.checkIn, before.checkOut, to, id);
        database
          .prepare("UPDATE bookings SET status = ? WHERE id = ? AND business_id = ? AND archived_at IS NULL")
          .run(STATUS_TO_DATABASE[to], id, scopedBusinessId);
        const after = bookingFromRow(getBookingRow(id));
        audit.append({ entityType: "booking", entityId: id, action: "update", before, after });
        return after;
      }).immediate();
    },

    archiveBooking(id) {
      database.transaction(() => {
        const before = bookingFromRow(getBookingRow(id));
        if (before.status !== "draft" && before.status !== "cancelled") {
          throw new BookingRepositoryError(
            "INVALID_TRANSITION",
            "Only draft or cancelled bookings can be archived.",
          );
        }
        database
          .prepare("UPDATE bookings SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND business_id = ?")
          .run(id, scopedBusinessId);
        audit.append({
          entityType: "booking",
          entityId: id,
          action: "update",
          before,
          after: { ...before, archived: true },
        });
      }).immediate();
    },

    getBooking(id) {
      return bookingFromRow(getBookingRow(id));
    },

    listBookings(filter = {}) {
      if ((filter.scheduleFrom && !filter.scheduleTo) || (!filter.scheduleFrom && filter.scheduleTo)) {
        throw new BookingRepositoryError(
          "VALIDATION_ERROR",
          "Both schedule dates are required.",
        );
      }
      if (filter.scheduleFrom && filter.scheduleTo) {
        try {
          calculateNights({ checkIn: filter.scheduleFrom, checkOut: filter.scheduleTo });
        } catch (error) {
          asRepositoryValidation(error);
        }
      }
      const clauses = ["b.business_id = @businessId", "b.archived_at IS NULL"];
      const parameters: Record<string, string> = { businessId: scopedBusinessId };
      if (filter.status) {
        clauses.push("b.status = @status");
        parameters.status = STATUS_TO_DATABASE[filter.status];
      }
      if (filter.unitId) {
        clauses.push("b.unit_id = @unitId");
        parameters.unitId = filter.unitId;
      }
      if (filter.customerId) {
        clauses.push("b.customer_id = @customerId");
        parameters.customerId = filter.customerId;
      }
      if (filter.query?.trim()) {
        clauses.push("(lower(c.name) LIKE @query OR lower(u.name) LIKE @query)");
        parameters.query = `%${filter.query.trim().toLocaleLowerCase()}%`;
      }
      if (filter.scheduleFrom && filter.scheduleTo) {
        clauses.push("b.status IN ('confirmed', 'checked_in', 'completed')");
        clauses.push("b.check_in < @scheduleTo AND @scheduleFrom < b.check_out");
        parameters.scheduleFrom = filter.scheduleFrom;
        parameters.scheduleTo = filter.scheduleTo;
      }
      const rows = database
        .prepare<Record<string, string>, BookingRow>(`
          ${bookingSelect}
          WHERE ${clauses.join(" AND ")}
          GROUP BY b.id
          ORDER BY b.check_in, u.name, c.name, b.id
        `)
        .all(parameters)
        .map(bookingFromRow);
      if (filter.balance === "paid") return rows.filter(({ balance }) => balance <= 0);
      if (filter.balance === "unpaid") return rows.filter(({ received }) => received === 0);
      if (filter.balance === "outstanding") return rows.filter(({ balance }) => balance > 0);
      return rows;
    },
  };

  return Object.freeze(repository);
}
