import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { openEncryptedDatabase } from "../../src/main/db/connection";
import { migrateDatabase } from "../../src/main/db/migrations";
import { createAuditRepository } from "../../src/main/db/repositories/audit-repository";

const REQUIRED_TABLES = [
  "accounts",
  "app_meta",
  "assets",
  "audit_events",
  "balance_snapshots",
  "booking_months",
  "bookings",
  "businesses",
  "customers",
  "expenses",
  "inventory_snapshots",
  "loans",
  "payments",
  "period_closes",
  "recurring_expenses",
  "referral_earnings",
  "referrers",
  "staff_earnings",
  "staff_roles",
  "suppliers",
  "units",
] as const;

const MUTABLE_ARCHIVABLE_TABLES = [
  "accounts",
  "assets",
  "bookings",
  "businesses",
  "customers",
  "expenses",
  "loans",
  "recurring_expenses",
  "referrers",
  "staff_roles",
  "suppliers",
  "units",
] as const;

const MUTABLE_TABLES = [
  ...MUTABLE_ARCHIVABLE_TABLES,
  "balance_snapshots",
  "booking_months",
  "inventory_snapshots",
  "period_closes",
  "referral_earnings",
  "staff_earnings",
] as const;

const temporaryDirectories: string[] = [];

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "stay-books-db-"));
  temporaryDirectories.push(directory);
  return path.join(directory, "business.db");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("encrypted database", () => {
  it("persists data with the correct key and rejects a wrong key", () => {
    const databasePath = temporaryDatabasePath();
    const key = "correct horse battery staple";
    const database = openEncryptedDatabase(databasePath, key);

    database.exec("insert into app_meta(key,value) values ('probe','ok')");
    database.close();

    expect(readFileSync(databasePath).subarray(0, 16).toString()).not.toBe(
      "SQLite format 3\0",
    );
    expect(() => openEncryptedDatabase(databasePath, "wrong key")).toThrow();

    const reopened = openEncryptedDatabase(databasePath, key);
    const probe = reopened
      .prepare<[], { value: string }>(
        "select value from app_meta where key = 'probe'",
      )
      .get();

    expect(probe?.value).toBe("ok");
    reopened.close();
  });

  it("rejects an empty encryption key", () => {
    expect(() => openEncryptedDatabase(temporaryDatabasePath(), "")).toThrow(
      "Encryption key",
    );
  });

  it("reopens a database with an apostrophe-containing key", () => {
    const databasePath = temporaryDatabasePath();
    const key = "owner's long private key";
    const database = openEncryptedDatabase(databasePath, key);
    database.exec("insert into app_meta(key,value) values ('quote','safe')");
    database.close();

    const reopened = openEncryptedDatabase(databasePath, key);
    expect(
      reopened
        .prepare<[], { value: string }>(
          "select value from app_meta where key = 'quote'",
        )
        .get()?.value,
    ).toBe("safe");
    reopened.close();
  });

  it("applies the complete version-one schema and connection safeguards", () => {
    const database = openEncryptedDatabase(temporaryDatabasePath(), "test key");
    const tableRows = database
      .prepare<[], { name: string }>(
        "select name from sqlite_master where type = 'table' order by name",
      )
      .all();
    const tableNames = tableRows.map(({ name }) => name);

    expect(tableNames).toEqual(expect.arrayContaining([...REQUIRED_TABLES]));
    expect(database.pragma("user_version", { simple: true })).toBe(1);
    expect(database.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(database.pragma("journal_mode", { simple: true })).toBe("wal");

    for (const table of MUTABLE_ARCHIVABLE_TABLES) {
      const columns = database
        .prepare<[], { name: string }>(`pragma table_info(${table})`)
        .all()
        .map(({ name }) => name);
      expect(columns, table).toEqual(
        expect.arrayContaining(["id", "created_at", "updated_at", "archived_at"]),
      );
    }

    database.close();
  });

  it("updates timestamps automatically for every mutable entity table", () => {
    const database = openEncryptedDatabase(temporaryDatabasePath(), "test key");
    const triggerNames = database
      .prepare<[], { name: string }>(
        "select name from sqlite_master where type = 'trigger'",
      )
      .all()
      .map(({ name }) => name);

    for (const table of MUTABLE_TABLES) {
      expect(triggerNames, table).toContain(`${table}_touch_updated_at`);
    }

    const businessId = "business-1";
    database
      .prepare("insert into businesses(id, name, updated_at) values (?, ?, ?)")
      .run(businessId, "Before", "2000-01-01T00:00:00.000Z");
    database
      .prepare("update businesses set name = ? where id = ?")
      .run("After", businessId);
    const updated = database
      .prepare<[], { updated_at: string }>(
        `select updated_at from businesses where id = '${businessId}'`,
      )
      .get();

    expect(updated?.updated_at).not.toBe("2000-01-01T00:00:00.000Z");
    database.close();
  });

  it("indexes every foreign-key child column", () => {
    const database = openEncryptedDatabase(temporaryDatabasePath(), "index key");

    for (const table of REQUIRED_TABLES) {
      const foreignKeys = database
        .prepare<[], { from: string }>(`pragma foreign_key_list(${table})`)
        .all();
      if (foreignKeys.length === 0) continue;

      const indexedFirstColumns = database
        .prepare<[], { name: string }>(`pragma index_list(${table})`)
        .all()
        .flatMap(({ name }) =>
          database
            .prepare<[], { name: string; seqno: number }>(
              `pragma index_info('${name.replaceAll("'", "''")}')`,
            )
            .all()
            .filter(({ seqno }) => seqno === 0)
            .map(({ name: column }) => column),
        );

      for (const foreignKey of foreignKeys) {
        expect(indexedFirstColumns, `${table}.${foreignKey.from}`).toContain(
          foreignKey.from,
        );
      }
    }

    database.close();
  });

  it("enforces foreign keys on every opened connection", () => {
    const database = openEncryptedDatabase(temporaryDatabasePath(), "fk key");

    expect(() =>
      database
        .prepare("insert into units(business_id, name) values (?, ?)")
        .run("missing-business", "Unit 1"),
    ).toThrow("FOREIGN KEY");

    database.close();
  });

  it("is idempotent when migrations are run again", () => {
    const database = openEncryptedDatabase(
      temporaryDatabasePath(),
      "migration key",
    );
    const before = database
      .prepare<[], { count: number }>(
        "select count(*) as count from sqlite_master",
      )
      .get()?.count;

    migrateDatabase(database);

    expect(
      database
        .prepare<[], { count: number }>(
          "select count(*) as count from sqlite_master",
        )
        .get()?.count,
    ).toBe(before);
    expect(
      database
        .prepare<[], { count: number }>(
          "select count(*) as count from app_meta where key = 'schema_version'",
        )
        .get()?.count,
    ).toBe(1);
    database.close();
  });

  it("rolls back a migration if a later schema statement fails", () => {
    const database = new Database(":memory:");
    database.exec("create table units (marker text)");

    expect(() => migrateDatabase(database)).toThrow("units already exists");
    expect(database.pragma("user_version", { simple: true })).toBe(0);
    expect(
      database
        .prepare<[], { name: string }>(
          "select name from sqlite_master where type = 'table' and name in ('app_meta', 'businesses')",
        )
        .all(),
    ).toEqual([]);
    expect(
      database
        .prepare<[], { name: string }>(
          "select name from sqlite_master where type = 'table' and name = 'units'",
        )
        .get()?.name,
    ).toBe("units");
    database.close();
  });
});

describe("audit repository", () => {
  it("appends serialized audit events without exposing mutation operations", () => {
    const database = openEncryptedDatabase(temporaryDatabasePath(), "audit key");
    const audit = createAuditRepository(database);

    audit.append({
      entityType: "booking",
      entityId: "booking-1",
      action: "update",
      reason: "Correct checkout date",
      before: { checkOut: "2026-07-13" },
      after: { checkOut: "2026-07-14" },
    });

    expect(Object.keys(audit)).toEqual(["append"]);
    expect(
      database
        .prepare<[], Record<string, string | null>>(
          "select entity_type, entity_id, action, reason, before_json, after_json from audit_events",
        )
        .get(),
    ).toEqual({
      entity_type: "booking",
      entity_id: "booking-1",
      action: "update",
      reason: "Correct checkout date",
      before_json: '{"checkOut":"2026-07-13"}',
      after_json: '{"checkOut":"2026-07-14"}',
    });

    database.close();
  });

  it("prevents existing audit events from being changed or deleted", () => {
    const database = openEncryptedDatabase(temporaryDatabasePath(), "audit key");
    createAuditRepository(database).append({
      entityType: "period",
      entityId: "2026-07",
      action: "close",
    });

    expect(() =>
      database.exec("update audit_events set reason = 'rewritten'"),
    ).toThrow("append-only");
    expect(() => database.exec("delete from audit_events")).toThrow("append-only");

    database.close();
  });
});
