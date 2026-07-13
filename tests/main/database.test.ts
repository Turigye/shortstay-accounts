import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openEncryptedDatabase } from "../../src/main/db/connection";
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
