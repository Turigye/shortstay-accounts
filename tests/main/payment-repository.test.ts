import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { createBookingRepository } from "../../src/main/db/repositories/booking-repository";
import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import {
  PaymentRepositoryError,
  createPaymentRepository,
  type PaymentRepository,
} from "../../src/main/db/repositories/payment-repository";
import { migrateDatabase } from "../../src/main/db/migrations";

interface Fixture {
  database: Database.Database;
  repository: PaymentRepository;
  businessId: string;
  bookingId: string;
  accountId: string;
}

const databases: Database.Database[] = [];

function createFixture(): Fixture {
  const database = new Database(":memory:");
  databases.push(database);
  database.pragma("foreign_keys = ON");
  migrateDatabase(database);
  const business = createBusinessRepository(database, {
    now: () => new Date("2026-07-14T09:00:00.000Z"),
  }).create({
    name: "Client Business",
    password: "long local password",
    unitNames: ["Lake View", "Garden Suite"],
  });
  const bookings = createBookingRepository(database, business.businessId);
  const customer = bookings.createCustomer({ name: "Amina N.", phone: "+256 700 123456" });
  const booking = bookings.createBooking({
    unitId: business.unitIds[0],
    customerId: customer.id,
    checkIn: "2026-07-20",
    checkOut: "2026-07-25",
    nightlyRate: 180_000,
    status: "confirmed",
  });
  const repository = createPaymentRepository(database, business.businessId);
  const account = repository.createAccount({ name: "Main Mobile Money", type: "mobileMoney" });
  return {
    database,
    repository,
    businessId: business.businessId,
    bookingId: booking.id,
    accountId: account.id,
  };
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function movementInput(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    bookingId: fixture.bookingId,
    amount: 300_000,
    paidAt: "2026-07-14T09:30:00.000Z",
    method: "mobileMoney" as const,
    accountId: fixture.accountId,
    reference: "MM-4421",
    ...overrides,
  };
}

describe("payment accounts", () => {
  it("requires an active business scope", () => {
    const fixture = createFixture();
    fixture.database
      .prepare("UPDATE businesses SET archived_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(fixture.businessId);

    expect(() => createPaymentRepository(fixture.database, fixture.businessId)).toThrowError(
      expect.objectContaining<Partial<PaymentRepositoryError>>({ code: "NOT_FOUND" }),
    );
  });

  it("adds, renames, lists, and archives local payment accounts", () => {
    const fixture = createFixture();
    const cash = fixture.repository.createAccount({ name: "Front Desk Cash", type: "cash" });
    const renamed = fixture.repository.updateAccount(cash.id, {
      name: "Reception Cash",
      type: "cash",
    });

    expect(renamed).toMatchObject({
      businessId: fixture.businessId,
      name: "Reception Cash",
      type: "cash",
      archived: false,
    });
    expect(fixture.repository.listAccounts()).toEqual([
      expect.objectContaining({ name: "Main Mobile Money" }),
      expect.objectContaining({ name: "Reception Cash" }),
    ]);

    fixture.repository.archiveAccount(cash.id);
    expect(fixture.repository.listAccounts()).toEqual([
      expect.objectContaining({ name: "Main Mobile Money" }),
    ]);
    expect(fixture.repository.getAccount(cash.id)).toMatchObject({ archived: true });
  });

  it("rejects archived and cross-business account IDs", () => {
    const fixture = createFixture();
    const archived = fixture.repository.createAccount({ name: "Old Cash", type: "cash" });
    fixture.repository.archiveAccount(archived.id);
    const otherBusiness = fixture.database
      .prepare<[], { id: string }>("INSERT INTO businesses (name) VALUES ('Other Business') RETURNING id")
      .get();
    if (!otherBusiness) throw new Error("other business was not created");
    const crossBusiness = fixture.database
      .prepare<[string], { id: string }>(
        "INSERT INTO accounts (business_id, name, type) VALUES (?, 'Other Cash', 'cash') RETURNING id",
      )
      .get(otherBusiness.id);
    if (!crossBusiness) throw new Error("cross-business account was not created");

    for (const accountId of [archived.id, crossBusiness.id]) {
      expect(() =>
        fixture.repository.recordReceipt(movementInput(fixture, { accountId })),
      ).toThrowError(
        expect.objectContaining<Partial<PaymentRepositoryError>>({ code: "NOT_FOUND" }),
      );
    }
  });
});

describe("booking movements", () => {
  it("records multiple receipts and a refund in chronological order", () => {
    const fixture = createFixture();
    fixture.repository.recordReceipt(movementInput(fixture));
    fixture.repository.recordReceipt(
      movementInput(fixture, {
        amount: 600_000,
        paidAt: "2026-07-15T08:00:00.000Z",
        reference: "MM-4422",
      }),
    );
    fixture.repository.recordRefund(
      movementInput(fixture, {
        amount: 100_000,
        paidAt: "2026-07-16T10:00:00.000Z",
        reference: "MM-REF-1",
      }),
    );

    expect(fixture.repository.getBookingBalance(fixture.bookingId)).toEqual({
      received: 900_000,
      refunded: 100_000,
      netReceived: 800_000,
      due: 100_000,
      state: "partiallyPaid",
    });
    expect(fixture.repository.listMovements({ bookingId: fixture.bookingId })).toEqual([
      expect.objectContaining({ recordType: "receipt", direction: "receipt", reference: "MM-4421" }),
      expect.objectContaining({ recordType: "receipt", direction: "receipt", reference: "MM-4422" }),
      expect.objectContaining({ recordType: "refund", direction: "refund", reference: "MM-REF-1" }),
    ]);
  });

  it("requires explicit confirmation before creating an overpayment", () => {
    const fixture = createFixture();
    expect(() =>
      fixture.repository.recordReceipt(movementInput(fixture, { amount: 900_001 })),
    ).toThrowError(
      expect.objectContaining<Partial<PaymentRepositoryError>>({
        code: "OVERPAYMENT_CONFIRMATION_REQUIRED",
      }),
    );
    expect(fixture.repository.listMovements({ bookingId: fixture.bookingId })).toHaveLength(0);

    const receipt = fixture.repository.recordReceipt(
      movementInput(fixture, { amount: 900_001, confirmOverpayment: true }),
    );
    expect(receipt.amount).toBe(900_001);
    expect(fixture.repository.getBookingBalance(fixture.bookingId).state).toBe("overpaid");
  });

  it("prevents an ordinary over-refund and audits explicit additional settlement", () => {
    const fixture = createFixture();
    fixture.repository.recordReceipt(movementInput(fixture));

    expect(() =>
      fixture.repository.recordRefund(movementInput(fixture, { amount: 300_001 })),
    ).toThrowError(
      expect.objectContaining<Partial<PaymentRepositoryError>>({ code: "OVER_REFUND" }),
    );
    expect(() =>
      fixture.repository.recordRefund(
        movementInput(fixture, { amount: 300_001, additionalSettlement: true, reason: " " }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PaymentRepositoryError>>({ code: "VALIDATION_ERROR" }),
    );

    const settlement = fixture.repository.recordRefund(
      movementInput(fixture, {
        amount: 350_000,
        additionalSettlement: true,
        reason: "Goodwill settlement for interrupted stay",
      }),
    );
    expect(settlement).toMatchObject({
      recordType: "refund",
      direction: "refund",
      additionalSettlement: true,
      reason: "Goodwill settlement for interrupted stay",
    });
    expect(fixture.repository.getBookingBalance(fixture.bookingId)).toMatchObject({
      netReceived: -50_000,
      due: 950_000,
      state: "fullyRefunded",
    });
  });

  it("reverses an original once with a reason and never changes the original", () => {
    const fixture = createFixture();
    const original = fixture.repository.recordReceipt(movementInput(fixture));
    expect(() =>
      fixture.repository.reverseMovement({
        paymentId: original.id,
        paidAt: "2026-07-15T09:30:00.000Z",
        reason: " ",
      }),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));

    const reversal = fixture.repository.reverseMovement({
      paymentId: original.id,
      paidAt: "2026-07-15T09:30:00.000Z",
      reason: "Receipt entered twice",
    });
    expect(reversal).toMatchObject({
      recordType: "reversal",
      direction: "refund",
      amount: 300_000,
      reversalOfId: original.id,
      reason: "Receipt entered twice",
    });
    expect(fixture.repository.getMovement(original.id)).toEqual(original);
    expect(() =>
      fixture.repository.reverseMovement({
        paymentId: original.id,
        paidAt: "2026-07-16T09:30:00.000Z",
        reason: "Another attempt",
      }),
    ).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("records a reasoned correction linked to its original", () => {
    const fixture = createFixture();
    const original = fixture.repository.recordReceipt(movementInput(fixture));
    expect(() =>
      fixture.repository.recordCorrection({
        ...movementInput(fixture, { amount: 20_000 }),
        originalPaymentId: original.id,
        direction: "refund",
        reason: " ",
      }),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));

    expect(
      fixture.repository.recordCorrection({
        ...movementInput(fixture, { amount: 20_000 }),
        originalPaymentId: original.id,
        direction: "refund",
        reason: "Receipt amount was overstated",
      }),
    ).toMatchObject({
      recordType: "correction",
      correctionOfId: original.id,
      direction: "refund",
      amount: 20_000,
      reason: "Receipt amount was overstated",
    });
  });

  it("rejects cross-business and archived booking IDs", () => {
    const fixture = createFixture();
    const otherBusiness = fixture.database
      .prepare<[], { id: string }>("INSERT INTO businesses (name) VALUES ('Other Business') RETURNING id")
      .get();
    if (!otherBusiness) throw new Error("other business was not created");
    const otherUnit = fixture.database
      .prepare<[string], { id: string }>(
        "INSERT INTO units (business_id, name) VALUES (?, 'Other Unit') RETURNING id",
      )
      .get(otherBusiness.id);
    const otherCustomer = fixture.database
      .prepare<[string], { id: string }>(
        "INSERT INTO customers (business_id, name, phone) VALUES (?, 'Other Guest', '0700') RETURNING id",
      )
      .get(otherBusiness.id);
    if (!otherUnit || !otherCustomer) throw new Error("other business references were not created");
    const otherBooking = fixture.database
      .prepare<[string, string, string], { id: string }>(`
        INSERT INTO bookings (
          business_id, unit_id, customer_id, check_in, check_out, nightly_rate, total_amount, status
        ) VALUES (?, ?, ?, '2026-07-20', '2026-07-21', 100000, 100000, 'confirmed') RETURNING id
      `)
      .get(otherBusiness.id, otherUnit.id, otherCustomer.id);
    if (!otherBooking) throw new Error("other booking was not created");

    for (const bookingId of [otherBooking.id, fixture.bookingId]) {
      if (bookingId === fixture.bookingId) {
        fixture.database
          .prepare("UPDATE bookings SET archived_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(bookingId);
      }
      expect(() =>
        fixture.repository.recordReceipt(movementInput(fixture, { bookingId })),
      ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
    }
  });

  it("enforces append-only movement rows in the database", () => {
    const fixture = createFixture();
    const receipt = fixture.repository.recordReceipt(movementInput(fixture));

    expect(() =>
      fixture.database.prepare("UPDATE payments SET amount = 1 WHERE id = ?").run(receipt.id),
    ).toThrow("append-only");
    expect(() =>
      fixture.database.prepare("DELETE FROM payments WHERE id = ?").run(receipt.id),
    ).toThrow("append-only");
  });

  it("rejects unsupported or cross-scope movement inserts at the database boundary", () => {
    const fixture = createFixture();
    const otherBusiness = fixture.database
      .prepare<[], { id: string }>("INSERT INTO businesses (name) VALUES ('Other Business') RETURNING id")
      .get();
    if (!otherBusiness) throw new Error("other business was not created");
    const otherAccount = fixture.database
      .prepare<[string], { id: string }>(
        "INSERT INTO accounts (business_id, name, type) VALUES (?, 'Other Cash', 'cash') RETURNING id",
      )
      .get(otherBusiness.id);
    if (!otherAccount) throw new Error("other account was not created");

    const insert = fixture.database.prepare(`
      INSERT INTO payments (
        business_id, booking_id, account_id, direction, amount, paid_at, method, record_type
      ) VALUES (?, ?, ?, 'receipt', 1000, '2026-07-14T09:30:00.000Z', ?, 'receipt')
    `);
    expect(() =>
      insert.run(fixture.businessId, fixture.bookingId, fixture.accountId, "other"),
    ).toThrow("invalid payment movement");
    expect(() =>
      insert.run(fixture.businessId, fixture.bookingId, otherAccount.id, "cash"),
    ).toThrow("invalid payment movement");
  });
});

describe("initial booking receipt", () => {
  it("creates the booking and nonzero initial receipt atomically", () => {
    const fixture = createFixture();
    const bookings = createBookingRepository(fixture.database, fixture.businessId);
    const customer = bookings.createCustomer({ name: "Brian K.", phone: "+256 755 000111" });
    const unitId = fixture.database
      .prepare<[string], { id: string }>(
        "SELECT id FROM units WHERE business_id = ? AND name = 'Garden Suite'",
      )
      .get(fixture.businessId)?.id;
    if (!unitId) throw new Error("unit was not found");

    const booking = bookings.createBooking({
      unitId,
      customerId: customer.id,
      checkIn: "2026-08-01",
      checkOut: "2026-08-03",
      nightlyRate: 180_000,
      initialPayment: {
        amount: 100_000,
        paidAt: "2026-07-14T09:30:00.000Z",
        method: "mobileMoney",
        accountId: fixture.accountId,
        reference: "MM-INITIAL",
      },
    });

    expect(booking).toMatchObject({
      paymentState: "partiallyPaid",
      received: 100_000,
      refunded: 0,
      netReceived: 100_000,
      due: 260_000,
    });
    expect(fixture.repository.listMovements({ bookingId: booking.id })).toEqual([
      expect.objectContaining({ recordType: "receipt", reference: "MM-INITIAL" }),
    ]);
  });

  it("rolls back the booking when its initial receipt cannot be posted", () => {
    const fixture = createFixture();
    const bookings = createBookingRepository(fixture.database, fixture.businessId);
    const customer = bookings.createCustomer({ name: "Brian K.", phone: "+256 755 000111" });
    const beforeCount = fixture.database.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM bookings").get()?.count;
    fixture.repository.archiveAccount(fixture.accountId);

    expect(() =>
      bookings.createBooking({
        unitId: fixture.database
          .prepare<[string], { id: string }>("SELECT id FROM units WHERE business_id = ? AND name = 'Garden Suite'")
          .get(fixture.businessId)!.id,
        customerId: customer.id,
        checkIn: "2026-08-01",
        checkOut: "2026-08-03",
        nightlyRate: 180_000,
        initialPayment: {
          amount: 100_000,
          paidAt: "2026-07-14T09:30:00.000Z",
          method: "mobileMoney",
          accountId: fixture.accountId,
        },
      }),
    ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));

    expect(
      fixture.database.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM bookings").get()?.count,
    ).toBe(beforeCount);
  });
});
