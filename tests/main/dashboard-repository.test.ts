import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../src/main/db/migrations";
import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import { createDashboardRepository } from "../../src/main/db/repositories/dashboard-repository";

const databases: Database.Database[] = [];
afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("today overview", () => {
  it("reconciles daily actions with operational records", () => {
    const database = new Database(":memory:");
    databases.push(database);
    database.pragma("foreign_keys = ON");
    migrateDatabase(database);
    const business = createBusinessRepository(database, {
      now: () => new Date("2026-07-14T09:00:00Z"),
    }).create({
      name: "Eden Grove",
      password: "correct local password",
      unitNames: ["Unit 1", "Unit 2"],
    });
    const account = database.prepare<[string], { id: string }>(
      "INSERT INTO accounts (business_id,name,type) VALUES (?,'Cash','cash') RETURNING id",
    ).get(business.businessId)!;
    const customer = database.prepare<[string], { id: string }>(
      "INSERT INTO customers (business_id,name) VALUES (?,'David K.') RETURNING id",
    ).get(business.businessId)!;
    const booking = database.prepare<any, { id: string }>(
      `INSERT INTO bookings (business_id,unit_id,customer_id,check_in,check_out,nightly_rate,total_amount,status)
       VALUES (@businessId,@unitId,@customerId,'2026-07-12','2026-07-14',500000,1000000,'completed') RETURNING id`,
    ).get({
      businessId: business.businessId,
      unitId: business.unitIds[0],
      customerId: customer.id,
    })!;
    database.prepare(
      "INSERT INTO booking_months (booking_id,month,occupied_nights,earned_revenue,payable_base) VALUES (?,'2026-07',2,1000000,700000)",
    ).run(booking.id);
    database.prepare(
      "INSERT INTO payments (business_id,booking_id,account_id,direction,amount,paid_at,method,record_type) VALUES (?,?,?,'receipt',700000,'2026-07-14T09:00:00.000Z','cash','receipt')",
    ).run(business.businessId, booking.id, account.id);
    database.prepare(
      "INSERT INTO expenses (business_id,category_id,scope,amount,expense_date,purchase_type,payment_status) VALUES (?,'electricity','shared',80000,'2026-07-14','cash','paid')",
    ).run(business.businessId);

    const overview = createDashboardRepository(database, business.businessId).getToday("2026-07-14");
    expect(overview).toMatchObject({
      collected: 700_000,
      outstanding: 300_000,
      expenses: 80_000,
      taxProvision: 115_800,
    });
    expect(overview.agenda[0]).toMatchObject({
      type: "departure",
      customerName: "David K.",
      balance: 300_000,
    });
    expect(overview.performance).toHaveLength(6);
    expect(overview.performance.at(-1)).toMatchObject({
      month: "2026-07",
      collected: 700_000,
      expenses: 80_000,
    });
    expect(overview.warnings[0]).toMatchObject({ target: "payments" });
  });
});
