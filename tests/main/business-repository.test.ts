import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { createBusinessSession } from "../../src/main/business-session";
import { migrateDatabase } from "../../src/main/db/migrations";
import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";

const temporaryDirectories: string[] = [];

function createDatabase(): Database.Database {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  migrateDatabase(database);
  return database;
}

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "stay-books-business-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "business.db");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("business repository", () => {
  it("creates exactly two units and the approved financial defaults", () => {
    const database = createDatabase();
    const repository = createBusinessRepository(database, {
      now: () => new Date("2026-07-14T09:00:00.000Z"),
    });

    const business = repository.create({
      name: "Client Business",
      password: "long local password",
      unitNames: ["Lake View", "Garden Suite"],
    });

    expect(business.name).toBe("Client Business");
    expect(business.currency).toBe("UGX");
    expect(business.units.map(({ name }) => name)).toEqual([
      "Lake View",
      "Garden Suite",
    ]);
    expect(business.units).toHaveLength(2);
    expect(business.staffRates).toEqual({
      operations: 5,
      salesMarketing: 5,
      finance: 10,
      itLegal: 2,
      security: 5,
      ceo: 10,
    });
    expect(business.referralRate).toBe(10);
    expect(business.taxProvisionPerUnit).toBe(600_000);
    expect(business.rateHistory.staff).toHaveLength(6);
    expect(business.rateHistory.referral[0]?.effectiveFrom).toBe("2026-07-14");
    expect(business.rateHistory.taxProvision[0]?.value).toBe(600_000);

    database.close();
  });

  it("never stores the plaintext local password", () => {
    const database = createDatabase();
    const repository = createBusinessRepository(database);
    const password = "plain text must never persist";

    repository.create({ name: "Private Stays", password });

    const serializedValues = database
      .prepare<[], { value: string }>(`
        SELECT CAST(name AS TEXT) AS value FROM businesses
        UNION ALL SELECT CAST(value AS TEXT) FROM app_meta
        UNION ALL SELECT CAST(name AS TEXT) FROM units
        UNION ALL SELECT CAST(reason AS TEXT) FROM staff_roles WHERE reason IS NOT NULL
      `)
      .all()
      .map(({ value }) => value)
      .join(" ");
    expect(serializedValues).not.toContain(password);
    expect(
      database
        .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE sql LIKE '%password%'")
        .all(),
    ).toEqual([]);

    database.close();
  });

  it("stores effective-dated rate changes without rewriting prior rates", () => {
    const database = createDatabase();
    let currentTime = new Date("2026-07-14T09:00:00.000Z");
    const repository = createBusinessRepository(database, {
      now: () => currentTime,
    });
    repository.create({ name: "Client Business", password: "long local password" });

    const updated = repository.setRate({
      kind: "staff",
      role: "operations",
      value: 7.5,
      effectiveFrom: "2026-08-01",
    });

    expect(updated.staffRates.operations).toBe(5);
    expect(
      updated.rateHistory.staff
        .filter(({ role }) => role === "operations")
        .map(({ value, effectiveFrom }) => ({ value, effectiveFrom })),
    ).toEqual([
      { value: 5, effectiveFrom: "2026-07-14" },
      { value: 7.5, effectiveFrom: "2026-08-01" },
    ]);

    currentTime = new Date("2026-07-15T09:00:00.000Z");
    expect(
      repository.setRate({
        kind: "referral",
        value: 0,
        effectiveFrom: "2026-07-15",
      }).referralRate,
    ).toBe(0);

    database.close();
  });

  it("requires a reason for historical and closed-period rate changes", () => {
    const database = createDatabase();
    const repository = createBusinessRepository(database, {
      now: () => new Date("2026-07-14T09:00:00.000Z"),
    });
    const business = repository.create({
      name: "Client Business",
      password: "long local password",
    });

    expect(() =>
      repository.setRate({
        kind: "referral",
        value: 12,
        effectiveFrom: "2026-06-01",
      }),
    ).toThrow("reason");

    database
      .prepare(
        "INSERT INTO period_closes (business_id, month, status, closed_at) VALUES (?, ?, 'closed', ?)",
      )
      .run(business.businessId, "2026-07", "2026-07-31T17:00:00.000Z");

    expect(() =>
      repository.setRate({
        kind: "taxProvision",
        value: 650_000,
        effectiveFrom: "2026-07-20",
      }),
    ).toThrow("reason");

    const updated = repository.setRate({
      kind: "taxProvision",
      value: 650_000,
      effectiveFrom: "2026-07-20",
      reason: "Approved correction after month-end review",
    });
    expect(updated.rateHistory.taxProvision.at(-1)).toMatchObject({
      value: 650_000,
      reason: "Approved correction after month-end review",
    });

    database.close();
  });
});

describe("local business session", () => {
  it("owns the encrypted database and closes it when locked", () => {
    const databasePath = temporaryDatabasePath();
    const session = createBusinessSession({ databasePath });

    expect(session.getStatus()).toEqual({ state: "setup" });
    const business = session.create({
      name: "Private Stays",
      unitNames: ["East Wing", "West Wing"],
      password: "correct local password",
    });
    expect(session.getStatus()).toMatchObject({ state: "ready", business });

    session.lock();
    expect(session.getStatus()).toEqual({ state: "locked" });
    expect(() => session.getSettings()).toThrow("locked");

    expect(() => session.unlock("wrong password")).toThrow("not recognized");
    expect(session.getStatus()).toEqual({ state: "locked" });
    expect(session.unlock("correct local password").name).toBe("Private Stays");

    session.lock();
    const rawFile = readFileSync(databasePath);
    expect(rawFile.subarray(0, 16).toString()).not.toBe("SQLite format 3\0");
  });
});
