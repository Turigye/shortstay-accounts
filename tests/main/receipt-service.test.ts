import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../src/main/db/migrations";
import { createBookingRepository } from "../../src/main/db/repositories/booking-repository";
import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import { createPaymentRepository } from "../../src/main/db/repositories/payment-repository";
import { createUserRepository } from "../../src/main/db/repositories/user-repository";
import {
  getReceiptDocument,
  renderReceiptHtml,
} from "../../src/main/receipt-service";

const databases: Database.Database[] = [];

function fixture() {
  const database = new Database(":memory:");
  databases.push(database);
  database.pragma("foreign_keys = ON");
  migrateDatabase(database);
  const business = createBusinessRepository(database).create({
    name: "Eden Grove",
    password: "correct local password",
    unitNames: ["Garden Studio", "Courtyard Suite"],
  });
  const actor = createUserRepository(database, business.businessId)
    .bootstrapAdmin("correct local password");
  const bookings = createBookingRepository(database, business.businessId, actor.id);
  const customer = bookings.createCustomer({
    name: "Amina <Kato>",
    phone: "+256 700 123456",
  });
  const booking = bookings.createBooking({
    unitId: business.unitIds[0],
    customerId: customer.id,
    checkIn: "2026-07-20",
    checkOut: "2026-07-23",
    nightlyRate: 100_000,
    occupancyMode: "one_room",
  });
  const payments = createPaymentRepository(database, business.businessId, actor.id);
  const account = payments.createAccount({ name: "Front Desk Cash", type: "cash" });
  const receipt = payments.recordReceipt({
    bookingId: booking.id,
    accountId: account.id,
    amount: 150_000,
    paidAt: "2026-07-18T09:30:00.000Z",
    method: "cash",
    reference: "CASH-001",
  });
  return { actor, business, database, receipt };
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("receipt service", () => {
  it("projects a stable immutable booking receipt", () => {
    const { actor, business, database, receipt } = fixture();

    expect(getReceiptDocument(database, business.businessId, receipt.id)).toMatchObject({
      reference: expect.stringMatching(/^RCT-20260718-[A-F0-9]{6}$/),
      businessName: "Eden Grove",
      guestName: "Amina <Kato>",
      unitName: "Garden Studio",
      occupancyMode: "one_room",
      amount: 150_000,
      amountWords: "One hundred fifty thousand Uganda shillings only",
      receivedAfter: 150_000,
      remainingBalance: 150_000,
      receivedBy: "Owner",
      receivedByUserId: actor.id,
      reversed: false,
    });
  });

  it("escapes receipt data in a print-only HTML document", () => {
    const { business, database, receipt } = fixture();
    const html = renderReceiptHtml(
      getReceiptDocument(database, business.businessId, receipt.id),
    );

    expect(html).toContain("Amina &lt;Kato&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("sidebar");
    expect(html).toContain("@media print");
  });
});
