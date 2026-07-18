import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "../../src/main/authorization";
import { createBusinessSession } from "../../src/main/business-session";
import type { CredentialVault } from "../../src/main/credential-vault";

const directories: string[] = [];

function databasePath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "staybooks-session-"));
  directories.push(directory);
  return path.join(directory, "business.db");
}

function memoryVault(): CredentialVault & { value: string | null } {
  return {
    value: null,
    load() {
      return this.value;
    },
    save(secret) {
      this.value = secret;
    },
    clear() {
      this.value = null;
    },
  };
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

describe("profile-aware business session", () => {
  it("creates the initial Admin and separates logout from database lock", () => {
    const vault = memoryVault();
    const session = createBusinessSession({
      databasePath: databasePath(),
      credentialVault: vault,
    });

    const created = session.create({
      name: "Eden Grove",
      password: "correct local password",
      unitNames: ["Unit 1", "Unit 2"],
    });
    expect(created).toMatchObject({
      state: "ready",
      business: { name: "Eden Grove" },
      user: { username: "admin", role: "admin" },
    });
    expect(created.user).toStrictEqual({
      id: expect.any(String),
      name: "Owner",
      username: "admin",
      role: "admin",
    });
    expect(vault.value).toBe("correct local password");

    session.logout();
    expect(session.getStatus()).toMatchObject({
      state: "profileLocked",
      business: { name: "Eden Grove" },
    });
    expect(session.login({
      username: "admin",
      password: "correct local password",
    })).toMatchObject({ state: "ready", user: { role: "admin" } });

    session.lock();
    expect(session.getStatus()).toEqual({ state: "databaseLocked" });
  });

  it("opens from secure storage and allows an Editor to sign in independently", () => {
    const file = databasePath();
    const vault = memoryVault();
    const ownerSession = createBusinessSession({ databasePath: file, credentialVault: vault });
    ownerSession.create({ name: "Eden Grove", password: "correct local password" });
    const editor = ownerSession.createEditor({
      name: "Front Desk",
      username: "desk",
      password: "initial editor password",
    });
    ownerSession.lock();

    const reopened = createBusinessSession({ databasePath: file, credentialVault: vault });
    expect(reopened.getStatus().state).toBe("profileLocked");
    expect(reopened.login({
      username: "desk",
      password: "initial editor password",
    })).toMatchObject({ user: { id: editor.id, role: "editor" } });
    reopened.lock();
  });

  it("enforces Editor permissions inside the main-process session", () => {
    const session = createBusinessSession({
      databasePath: databasePath(),
      credentialVault: memoryVault(),
    });
    session.create({ name: "Eden Grove", password: "correct local password" });
    session.createEditor({
      name: "Front Desk",
      username: "desk",
      password: "initial editor password",
    });
    session.logout();
    session.login({ username: "desk", password: "initial editor password" });

    expect(() => session.listBookings()).not.toThrow();
    expect(() => session.listAccounts()).not.toThrow();
    expect(() => session.manageUnits({ units: [{ name: "Changed" }] })).toThrowError(
      expect.objectContaining<Partial<AuthorizationError>>({ code: "FORBIDDEN" }),
    );
    expect(() => session.recordRefund({
      bookingId: "crafted",
      accountId: "crafted",
      amount: 1,
      paidAt: "2026-07-18T09:00:00.000Z",
      method: "cash",
    })).toThrowError(
      expect.objectContaining<Partial<AuthorizationError>>({ code: "FORBIDDEN" }),
    );
    session.lock();
  });
});
