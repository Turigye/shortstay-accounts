import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { createBookingRepository } from "../../src/main/db/repositories/booking-repository";
import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import {
  createCompensationRepository,
} from "../../src/main/db/repositories/compensation-repository";
import { createPaymentRepository } from "../../src/main/db/repositories/payment-repository";
import { migrateDatabase } from "../../src/main/db/migrations";

const databases: Database.Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function fixture() {
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
    checkIn: "2026-07-30",
    checkOut: "2026-08-03",
    nightlyRate: 200_000,
    referred: true,
    referrerName: "Kato Travel",
    status: "confirmed",
  });
  const payments = createPaymentRepository(database, business.businessId);
  const account = payments.createAccount({ name: "Main Mobile Money", type: "mobileMoney" });
  return { database, business, bookings, booking, payments, account };
}

describe("compensation read model", () => {
  it("attributes partial collections to occupied months after completion", () => {
    const { database, business, bookings, booking, payments, account } = fixture();
    payments.recordReceipt({
      bookingId: booking.id,
      amount: 400_000,
      paidAt: "2026-07-30T09:30:00.000Z",
      method: "mobileMoney",
      accountId: account.id,
    });
    bookings.transitionBooking(booking.id, "checkedIn");
    bookings.transitionBooking(booking.id, "completed");

    const repository = createCompensationRepository(database, business.businessId);
    const july = repository.getMonthlyReport("2026-07");
    const august = repository.getMonthlyReport("2026-08");

    expect(july.ncbr).toBe(200_000);
    expect(august.ncbr).toBe(200_000);
    expect(july.staff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "operations", rate: 5, earned: 10_000, due: 10_000 }),
        expect.objectContaining({ role: "finance", rate: 10, earned: 20_000, due: 20_000 }),
      ]),
    );
    expect(july.referrals).toEqual([
      expect.objectContaining({
        bookingId: booking.id,
        referrerName: "Kato Travel",
        base: 200_000,
        rate: 10,
        earned: 20_000,
        due: 20_000,
      }),
    ]);
    expect(july.traces).toEqual([
      expect.objectContaining({ bookingId: booking.id, eligibleBase: 200_000 }),
    ]);
  });

  it("returns all six roles with zero due in a zero-business month", () => {
    const { database, business } = fixture();
    const report = createCompensationRepository(database, business.businessId)
      .getMonthlyReport("2026-09");

    expect(report.ncbr).toBe(0);
    expect(report.staff).toHaveLength(6);
    expect(report.staff.every(({ earned, due }) => earned === 0 && due === 0)).toBe(true);
    expect(report.referrals).toEqual([]);
    expect(report.traces).toEqual([]);
  });
});
