import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import {
  BookingRepositoryError,
  createBookingRepository,
  type BookingRepository,
} from "../../src/main/db/repositories/booking-repository";
import { migrateDatabase } from "../../src/main/db/migrations";
import { createUserRepository } from "../../src/main/db/repositories/user-repository";

interface Fixture {
  database: Database.Database;
  repository: BookingRepository;
  businessId: string;
  unitIds: [string, string];
  customerId: string;
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
  const repository = createBookingRepository(database, business.businessId);
  const customer = repository.createCustomer({
    name: "Amina N.",
    phone: "+256 700 123456",
    email: "amina@example.com",
  });
  return {
    database,
    repository,
    businessId: business.businessId,
    unitIds: business.unitIds as [string, string],
    customerId: customer.id,
  };
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function bookingInput(fixture: Fixture, overrides: Record<string, unknown> = {}) {
  return {
    unitId: fixture.unitIds[0],
    customerId: fixture.customerId,
    checkIn: "2026-07-20",
    checkOut: "2026-07-22",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    nightlyRate: 180_000,
    adjustment: -20_000,
    status: "confirmed" as const,
    ...overrides,
  };
}

describe("customers", () => {
  it("creates, updates, lists, and archives customers inside the business", () => {
    const fixture = createFixture();
    const updated = fixture.repository.updateCustomer(fixture.customerId, {
      name: "Amina Namusoke",
      phone: "+256 700 123456",
      email: null,
      notes: "Prefers the garden unit",
    });

    expect(updated).toMatchObject({
      businessId: fixture.businessId,
      name: "Amina Namusoke",
      email: null,
    });
    expect(fixture.repository.listCustomers()).toEqual([updated]);

    fixture.repository.archiveCustomer(fixture.customerId);
    expect(fixture.repository.listCustomers()).toEqual([]);
    expect(fixture.repository.getCustomer(fixture.customerId)).toMatchObject({ archived: true });
  });

  it("rejects invalid customer contact details", () => {
    const { repository } = createFixture();
    expect(() => repository.createCustomer({ name: " ", phone: "" })).toThrowError(
      expect.objectContaining<Partial<BookingRepositoryError>>({
        code: "VALIDATION_ERROR",
        fieldErrors: expect.objectContaining({ name: expect.any(Array), phone: expect.any(Array) }),
      }),
    );
  });
});

describe("booking repository", () => {
  it("attributes new booking audit events to the active user", () => {
    const fixture = createFixture();
    const actor = createUserRepository(fixture.database, fixture.businessId)
      .bootstrapAdmin("long local password");
    const repository = createBookingRepository(
      fixture.database,
      fixture.businessId,
      actor.id,
    );

    const booking = repository.createBooking(bookingInput(fixture));
    expect(
      fixture.database
        .prepare<[string], { actor_user_id: string | null }>(
          "SELECT actor_user_id FROM audit_events WHERE entity_type = 'booking' AND entity_id = ?",
        )
        .get(booking.id),
    ).toEqual({ actor_user_id: actor.id });
  });

  it("creates an exact unpaid booking and preserves manual fields", () => {
    const fixture = createFixture();
    const booking = fixture.repository.createBooking({
      ...bookingInput(fixture),
      referred: true,
      referrerName: "Kato Travel",
      notes: "Late arrival",
    });

    expect(booking).toMatchObject({
      businessId: fixture.businessId,
      customerId: fixture.customerId,
      customerName: "Amina N.",
      unitName: "Lake View",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      nights: 2,
      total: 340_000,
      paymentState: "unpaid",
      received: 0,
      balance: 340_000,
      referrerName: "Kato Travel",
      notes: "Late arrival",
    });
  });

  it("allows adjacent confirmed stays and rejects true overlaps", () => {
    const fixture = createFixture();
    fixture.repository.createBooking(bookingInput(fixture));

    expect(() =>
      fixture.repository.createBooking(
        bookingInput(fixture, { checkIn: "2026-07-22", checkOut: "2026-07-24" }),
      ),
    ).not.toThrow();
    expect(() =>
      fixture.repository.createBooking(
        bookingInput(fixture, { checkIn: "2026-07-21", checkOut: "2026-07-23" }),
      ),
    ).toThrowError(
      expect.objectContaining<Partial<BookingRepositoryError>>({
        code: "CONFLICT",
        fieldErrors: { dates: [expect.stringContaining("Lake View")] },
      }),
    );
  });

  it("allows two one-room stays but blocks a third or a whole-unit overlap", () => {
    const fixture = createFixture();
    fixture.repository.createBooking(
      bookingInput(fixture, { occupancyMode: "one_room" }),
    );
    fixture.repository.createBooking(
      bookingInput(fixture, {
        customerId: fixture.repository.createCustomer({
          name: "Brian K.",
          phone: "0700000001",
        }).id,
        occupancyMode: "one_room",
      }),
    );

    expect(() =>
      fixture.repository.createBooking(
        bookingInput(fixture, {
          customerId: fixture.repository.createCustomer({
            name: "Carol A.",
            phone: "0700000002",
          }).id,
          occupancyMode: "one_room",
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    expect(() =>
      fixture.repository.createBooking(
        bookingInput(fixture, {
          checkIn: "2026-07-21",
          checkOut: "2026-07-23",
          occupancyMode: "whole_unit",
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("supports a fixed total for historic monthly and partial-room rent", () => {
    const fixture = createFixture();
    const booking = fixture.repository.createBooking(
      bookingInput(fixture, {
        pricingMode: "fixed",
        fixedAmount: 650_000,
        nightlyRate: 0,
        adjustment: -50_000,
        occupancyMode: "one_room",
      }),
    );

    expect(booking).toMatchObject({
      pricingMode: "fixed",
      fixedAmount: 650_000,
      occupancyMode: "one_room",
      total: 600_000,
    });
  });

  it("lets drafts overlap but rechecks inside the confirm transaction", () => {
    const fixture = createFixture();
    const staleDraft = fixture.repository.createBooking(
      bookingInput(fixture, { status: "draft" }),
    );
    fixture.repository.createBooking(bookingInput(fixture));

    expect(() => fixture.repository.transitionBooking(staleDraft.id, "confirmed")).toThrowError(
      expect.objectContaining<Partial<BookingRepositoryError>>({ code: "CONFLICT" }),
    );
    expect(fixture.repository.getBooking(staleDraft.id).status).toBe("draft");
  });

  it("reuses one persisted customer when a failed booking is retried", () => {
    const fixture = createFixture();
    fixture.repository.createBooking(bookingInput(fixture));
    const customer = fixture.repository.createCustomer({
      name: "Brian K.",
      phone: "+256 755 000111",
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(() =>
        fixture.repository.createBooking(
          bookingInput(fixture, { customerId: customer.id }),
        ),
      ).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    }

    expect(
      fixture.repository.listCustomers().filter(({ name }) => name === "Brian K."),
    ).toHaveLength(1);
  });

  it("rechecks overlap when an existing confirmed booking is updated", () => {
    const fixture = createFixture();
    const first = fixture.repository.createBooking(bookingInput(fixture));
    fixture.repository.createBooking(
      bookingInput(fixture, { checkIn: "2026-07-25", checkOut: "2026-07-27" }),
    );

    expect(() =>
      fixture.repository.updateBooking(first.id, {
        ...bookingInput(fixture),
        checkIn: "2026-07-24",
        checkOut: "2026-07-26",
      }),
    ).toThrowError(expect.objectContaining<Partial<BookingRepositoryError>>({ code: "CONFLICT" }));
    expect(fixture.repository.getBooking(first.id).checkOut).toBe("2026-07-22");
  });

  it("releases cancelled ranges while drafts remain absent from the active schedule", () => {
    const fixture = createFixture();
    const booking = fixture.repository.createBooking(bookingInput(fixture));
    fixture.repository.transitionBooking(booking.id, "cancelled");
    fixture.repository.createBooking(bookingInput(fixture));
    fixture.repository.createBooking(bookingInput(fixture, { status: "draft" }));

    expect(fixture.repository.listBookings({ scheduleFrom: "2026-07-20", scheduleTo: "2026-07-23" }))
      .toHaveLength(1);
  });

  it("removes a mistaken unpaid booking and all derived report rows", () => {
    const fixture = createFixture();
    const booking = fixture.repository.createBooking(bookingInput(fixture));

    fixture.repository.archiveBooking(booking.id);

    expect(fixture.repository.listBookings()).toEqual([]);
    for (const table of ["booking_months", "staff_earnings", "referral_earnings"]) {
      expect(
        fixture.database
          .prepare(`SELECT COUNT(*) count FROM ${table} WHERE booking_id = ?`)
          .get(booking.id),
      ).toMatchObject({ count: 0 });
    }
  });

  it("refuses to remove a booking that has payment history", () => {
    const fixture = createFixture();
    const account = fixture.database
      .prepare<[string], { id: string }>(
        "INSERT INTO accounts (business_id, name, type) VALUES (?, 'Test Mobile Money', 'mobile_money') RETURNING id",
      )
      .get(fixture.businessId);
    if (!account) throw new Error("default account was not created");
    const booking = fixture.repository.createBooking(
      bookingInput(fixture, {
        initialPayment: {
          amount: 100_000,
          paidAt: "2026-07-14T09:00:00.000Z",
          method: "mobileMoney",
          accountId: account.id,
        },
      }),
    );

    expect(() => fixture.repository.archiveBooking(booking.id)).toThrowError(
      expect.objectContaining({ code: "CONFLICT" }),
    );
    expect(fixture.repository.getBooking(booking.id).id).toBe(booking.id);
  });

  it("enforces legal transitions and terminal states", () => {
    const fixture = createFixture();
    const booking = fixture.repository.createBooking(bookingInput(fixture, { status: "draft" }));

    expect(() => fixture.repository.transitionBooking(booking.id, "completed")).toThrowError(
      expect.objectContaining<Partial<BookingRepositoryError>>({ code: "INVALID_TRANSITION" }),
    );
    fixture.repository.transitionBooking(booking.id, "confirmed");
    fixture.repository.transitionBooking(booking.id, "checkedIn");
    fixture.repository.transitionBooking(booking.id, "completed");
    expect(() => fixture.repository.transitionBooking(booking.id, "cancelled")).toThrowError(
      expect.objectContaining<Partial<BookingRepositoryError>>({ code: "INVALID_TRANSITION" }),
    );
    expect(() => fixture.repository.updateBooking(booking.id, bookingInput(fixture))).toThrowError(
      expect.objectContaining<Partial<BookingRepositoryError>>({ code: "INVALID_TRANSITION" }),
    );
  });

  it("rejects invalid dates, negative totals, and referral omissions", () => {
    const fixture = createFixture();
    expect(() =>
      fixture.repository.createBooking(bookingInput(fixture, { checkOut: "2026-07-20" })),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(() =>
      fixture.repository.createBooking(bookingInput(fixture, { adjustment: -400_000 })),
    ).toThrowError(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(() =>
      fixture.repository.createBooking(bookingInput(fixture, { referred: true })),
    ).toThrowError(
      expect.objectContaining({ fieldErrors: { referrerName: [expect.any(String)] } }),
    );
  });

  it.each([
    { referred: false, referrerName: "Kato Travel" },
    { referred: false, referrerId: "referrer-1" },
    { referred: true },
    { referred: true, referrerName: "  " },
    { referrerName: "Kato Travel" },
    { referred: true, referrerId: "referrer-1", referrerName: "Kato Travel" },
  ])("rejects contradictory referral intent: %#", (referral) => {
    const fixture = createFixture();
    if (referral.referrerId) {
      fixture.database
        .prepare(
          "INSERT INTO referrers (id, business_id, name) VALUES (?, ?, 'Existing Referrer')",
        )
        .run(referral.referrerId, fixture.businessId);
    }

    expect(() =>
      fixture.repository.createBooking(bookingInput(fixture, referral)),
    ).toThrowError(
      expect.objectContaining<Partial<BookingRepositoryError>>({
        code: "VALIDATION_ERROR",
      }),
    );
  });

  it("accepts one active business-scoped referrer ID", () => {
    const fixture = createFixture();
    const referrer = fixture.database
      .prepare<[string], { id: string }>(
        "INSERT INTO referrers (business_id, name) VALUES (?, 'Existing Referrer') RETURNING id",
      )
      .get(fixture.businessId);
    if (!referrer) throw new Error("test referrer was not created");

    expect(
      fixture.repository.createBooking(
        bookingInput(fixture, { referred: true, referrerId: referrer.id }),
      ).referrerId,
    ).toBe(referrer.id);
  });

  it("rejects archived and cross-business referrer IDs", () => {
    const fixture = createFixture();
    const archived = fixture.database
      .prepare<[string], { id: string }>(
        "INSERT INTO referrers (business_id, name, archived_at) VALUES (?, 'Archived', CURRENT_TIMESTAMP) RETURNING id",
      )
      .get(fixture.businessId);
    const otherBusiness = fixture.database
      .prepare<[], { id: string }>(
        "INSERT INTO businesses (name) VALUES ('Referral Business') RETURNING id",
      )
      .get();
    if (!archived || !otherBusiness) throw new Error("test referral scope was not created");
    const crossBusiness = fixture.database
      .prepare<[string], { id: string }>(
        "INSERT INTO referrers (business_id, name) VALUES (?, 'Cross Business') RETURNING id",
      )
      .get(otherBusiness.id);
    if (!crossBusiness) throw new Error("cross-business referrer was not created");

    for (const referrerId of [archived.id, crossBusiness.id]) {
      expect(() =>
        fixture.repository.createBooking(
          bookingInput(fixture, { referred: true, referrerId }),
        ),
      ).toThrowError(
        expect.objectContaining<Partial<BookingRepositoryError>>({ code: "NOT_FOUND" }),
      );
    }
  });

  it("rejects archived and cross-business unit or customer IDs", () => {
    const fixture = createFixture();
    const otherBusiness = fixture.database
      .prepare<[], { id: string }>("INSERT INTO businesses (name) VALUES ('Other Business') RETURNING id")
      .get();
    if (!otherBusiness) throw new Error("test business was not created");
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
    if (!otherUnit || !otherCustomer) throw new Error("test references were not created");

    expect(() =>
      fixture.repository.createBooking(bookingInput(fixture, { unitId: otherUnit.id })),
    ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
    expect(() =>
      fixture.repository.createBooking(bookingInput(fixture, { customerId: otherCustomer.id })),
    ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));

    fixture.database
      .prepare("UPDATE units SET status = 'inactive', archived_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(fixture.unitIds[1]);
    fixture.repository.archiveCustomer(fixture.customerId);
    expect(() =>
      fixture.repository.createBooking(bookingInput(fixture, { unitId: fixture.unitIds[1] })),
    ).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
    expect(() => fixture.repository.createBooking(bookingInput(fixture))).toThrowError(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });
});
