import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBusinessSession } from "../../src/main/business-session";
import { migrateDatabase } from "../../src/main/db/migrations";
import {
  BusinessRepositoryError,
  createBusinessRepository,
  type BusinessRepository,
} from "../../src/main/db/repositories/business-repository";

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
    rmSync(directory, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
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

  it("updates a rate on the baseline effective date and audits before and after", () => {
    const database = createDatabase();
    const repository = createBusinessRepository(database, {
      now: () => new Date("2026-07-14T09:00:00.000Z"),
    });
    repository.create({ name: "Client Business", password: "long local password" });

    const updated = repository.setRate({
      kind: "staff",
      role: "operations",
      value: 8,
      effectiveFrom: "2026-07-14",
    });

    expect(
      updated.rateHistory.staff.filter(({ role }) => role === "operations"),
    ).toEqual([
      expect.objectContaining({
        value: 8,
        effectiveFrom: "2026-07-14",
        reason: null,
      }),
    ]);
    const audit = database
      .prepare<[], { reason: string | null; before_json: string; after_json: string }>(`
        SELECT reason, before_json, after_json
        FROM audit_events
        WHERE entity_type = 'staff_rate'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `)
      .get();
    expect(audit).toEqual({
      reason: null,
      before_json: JSON.stringify({
        kind: "staff",
        role: "operations",
        value: 5,
        effectiveFrom: "2026-07-14",
        reason: null,
      }),
      after_json: JSON.stringify({
        kind: "staff",
        role: "operations",
        value: 8,
        effectiveFrom: "2026-07-14",
        reason: null,
      }),
    });

    database.close();
  });

  it("keeps denormalized referral and tax values on the latest applicable history", () => {
    const database = createDatabase();
    const repository = createBusinessRepository(database, {
      now: () => new Date("2026-07-14T09:00:00.000Z"),
    });
    repository.create({ name: "Client Business", password: "long local password" });

    repository.setRate({
      kind: "referral",
      value: 12,
      effectiveFrom: "2026-07-14",
    });
    repository.setRate({
      kind: "taxProvision",
      value: 700_000,
      effectiveFrom: "2026-07-14",
    });
    repository.setRate({
      kind: "referral",
      value: 18,
      effectiveFrom: "2026-08-01",
    });
    repository.setRate({
      kind: "taxProvision",
      value: 900_000,
      effectiveFrom: "2026-08-01",
    });
    const afterBackfill = repository.setRate({
      kind: "referral",
      value: 7,
      effectiveFrom: "2026-06-01",
      reason: "Record the earlier approved rate",
    });
    const afterTaxBackfill = repository.setRate({
      kind: "taxProvision",
      value: 500_000,
      effectiveFrom: "2026-06-01",
      reason: "Record the earlier planning amount",
    });

    expect(afterBackfill.referralRate).toBe(12);
    expect(afterTaxBackfill.taxProvisionPerUnit).toBe(700_000);
    expect(
      database
        .prepare<[], {
          referral_rate_basis_points: number;
          tax_provision_per_unit: number;
        }>(`
          SELECT referral_rate_basis_points, tax_provision_per_unit
          FROM businesses
          LIMIT 1
        `)
        .get(),
    ).toEqual({
      referral_rate_basis_points: 1_200,
      tax_provision_per_unit: 700_000,
    });
    expect(afterTaxBackfill.rateHistory.referral.map(({ effectiveFrom }) => effectiveFrom)).toEqual([
      "2026-06-01",
      "2026-07-14",
      "2026-08-01",
    ]);
    expect(afterTaxBackfill.rateHistory.taxProvision.map(({ effectiveFrom }) => effectiveFrom)).toEqual([
      "2026-06-01",
      "2026-07-14",
      "2026-08-01",
    ]);

    database.close();
  });

  it("activates future referral and tax history on read without another write", () => {
    const database = createDatabase();
    let currentTime = new Date("2026-07-14T09:00:00.000Z");
    const repository = createBusinessRepository(database, {
      now: () => currentTime,
    });
    repository.create({ name: "Client Business", password: "long local password" });
    repository.setRate({
      kind: "referral",
      value: 18,
      effectiveFrom: "2026-08-01",
    });
    repository.setRate({
      kind: "taxProvision",
      value: 900_000,
      effectiveFrom: "2026-08-01",
    });

    const beforeEffective = repository.getSettings();
    expect(beforeEffective).toMatchObject({
      referralRate: 10,
      taxProvisionPerUnit: 600_000,
    });
    expect(
      database
        .prepare<[], {
          referral_rate_basis_points: number;
          tax_provision_per_unit: number;
        }>(`
          SELECT referral_rate_basis_points, tax_provision_per_unit
          FROM businesses
          LIMIT 1
        `)
        .get(),
    ).toEqual({
      referral_rate_basis_points: 1_000,
      tax_provision_per_unit: 600_000,
    });
    const auditCountBeforeActivation = database
      .prepare<[], { count: number }>("SELECT count(*) AS count FROM audit_events")
      .get()?.count;

    currentTime = new Date("2026-08-01T00:00:00.000Z");
    const afterEffective = repository.getSettings();

    expect(afterEffective).toMatchObject({
      referralRate: 18,
      taxProvisionPerUnit: 900_000,
    });
    expect(
      database
        .prepare<[], {
          referral_rate_basis_points: number;
          tax_provision_per_unit: number;
        }>(`
          SELECT referral_rate_basis_points, tax_provision_per_unit
          FROM businesses
          LIMIT 1
        `)
        .get(),
    ).toEqual({
      referral_rate_basis_points: 1_800,
      tax_provision_per_unit: 900_000,
    });
    expect(
      database
        .prepare<[], { count: number }>("SELECT count(*) AS count FROM audit_events")
        .get()?.count,
    ).toBe(auditCountBeforeActivation);

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
    ).toThrowError(
      expect.objectContaining<Partial<BusinessRepositoryError>>({
        code: "VALIDATION_ERROR",
        message: "A reason is required for historical or closed-period changes.",
        fieldErrors: {
          effectiveFrom: ["Enter a reason for this historical or closed period."],
        },
      }),
    );

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

  it("adds, renames, and archives units without losing existing units", () => {
    const database = createDatabase();
    const repository = createBusinessRepository(database);
    const created = repository.create({
      name: "Client Business",
      password: "long local password",
      unitNames: ["Lake View", "Garden Suite"],
    });

    const withThird = repository.manageUnits({
      units: [
        { id: created.units[0].id, name: "Lake View" },
        { id: created.units[1].id, name: "Garden Suite" },
        { name: "Pool House" },
      ],
    });
    expect(withThird.units.map(({ name }) => name)).toEqual([
      "Lake View",
      "Garden Suite",
      "Pool House",
    ]);
    expect(withThird.unitIds.slice(0, 2)).toEqual(created.unitIds);

    const managed = repository.manageUnits({
      units: withThird.units.map(({ id, name }) => ({
        id,
        name: name === "Pool House" ? "Pool Cottage" : name,
      })),
    });
    expect(managed.units.map(({ name }) => name)).toEqual([
      "Lake View",
      "Garden Suite",
      "Pool Cottage",
    ]);
    expect(managed.unitIds.slice(0, 2)).toEqual(created.unitIds);

    const archivedId = managed.units[2].id;
    const afterArchive = repository.manageUnits({
      units: managed.units.slice(0, 2).map(({ id, name }) => ({ id, name })),
    });
    expect(afterArchive.unitIds).toEqual(created.unitIds);
    expect(
      database
        .prepare<[string], { status: string; archived_at: string | null }>(
          "SELECT status, archived_at FROM units WHERE id = ?",
        )
        .get(archivedId),
    ).toMatchObject({ status: "inactive", archived_at: expect.any(String) });

    database.close();
  });
});

describe("local business session", () => {
  it("owns the encrypted database and closes it when locked", () => {
    const databasePath = temporaryDatabasePath();
    const session = createBusinessSession({ databasePath });

    expect(session.getStatus()).toEqual({ state: "setup" });
    const created = session.create({
      name: "Private Stays",
      unitNames: ["East Wing", "West Wing"],
      password: "correct local password",
    });
    expect(session.getStatus()).toMatchObject({ state: "ready", business: created.business });

    session.lock();
    expect(session.getStatus()).toEqual({ state: "databaseLocked" });
    expect(() => session.getSettings()).toThrow("locked");

    expect(() => session.unlock("wrong password")).toThrow("not recognized");
    expect(session.getStatus()).toEqual({ state: "databaseLocked" });
    expect(session.unlock("correct local password").business.name).toBe("Private Stays");

    session.lock();
    const rawFile = readFileSync(databasePath);
    expect(rawFile.subarray(0, 16).toString()).not.toBe("SQLite format 3\0");
  });

  it("closes a post-open failure and leaves the session locked", () => {
    const databasePath = temporaryDatabasePath();
    const seed = createBusinessSession({ databasePath });
    seed.create({
      name: "Private Stays",
      password: "correct local password",
    });
    seed.lock();

    const close = vi.fn();
    const openDatabase = vi.fn(() => ({ close }) as unknown as Database.Database);
    const failingRepository = {
      getSettings: vi.fn(() => {
        throw new Error("settings read failed");
      }),
    } as unknown as BusinessRepository;
    const failedSession = createBusinessSession({
      databasePath,
      openDatabase,
      createRepository: () => failingRepository,
    });

    expect(() => failedSession.unlock("correct local password")).toThrow(
      "not recognized",
    );
    expect(close).toHaveBeenCalledOnce();
    expect(failedSession.getStatus()).toEqual({ state: "databaseLocked" });

    const successfulSession = createBusinessSession({ databasePath });
    expect(successfulSession.unlock("correct local password")).toMatchObject({
      state: "ready",
      business: { name: "Private Stays" },
      user: { role: "admin" },
    });
    successfulSession.lock();
  });
});
