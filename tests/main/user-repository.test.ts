import Database from "better-sqlite3-multiple-ciphers";
import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "../../src/main/db/migrations";
import { createBusinessRepository } from "../../src/main/db/repositories/business-repository";
import {
  UserRepositoryError,
  createUserRepository,
} from "../../src/main/db/repositories/user-repository";

const databases: Database.Database[] = [];

function fixture() {
  const database = new Database(":memory:");
  databases.push(database);
  database.pragma("foreign_keys = ON");
  migrateDatabase(database);
  const business = createBusinessRepository(database).create({
    name: "Eden Grove",
    password: "correct local password",
  });
  return {
    business,
    database,
    users: createUserRepository(database, business.businessId),
  };
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("user repository", () => {
  it("bootstraps one Admin and authenticates case-insensitively", () => {
    const { users } = fixture();

    const admin = users.bootstrapAdmin("correct local password");

    expect(admin).toMatchObject({
      name: "Owner",
      username: "admin",
      role: "admin",
      active: true,
    });
    expect(users.bootstrapAdmin("ignored duplicate password").id).toBe(admin.id);
    expect(users.authenticate("ADMIN", "correct local password")).toEqual(admin);
    expect(() => users.authenticate("admin", "wrong password")).toThrowError(
      new UserRepositoryError("AUTHENTICATION_FAILED", "The username or password was not recognized."),
    );
  });

  it("creates, resets, deactivates, and reactivates an Editor", () => {
    const { users } = fixture();
    users.bootstrapAdmin("correct local password");

    const editor = users.createEditor({
      name: "Front Desk",
      username: "desk",
      password: "initial editor password",
    });
    expect(users.authenticate("desk", "initial editor password")).toEqual(editor);

    users.resetEditorPassword(editor.id, "replacement editor password");
    expect(() => users.authenticate("desk", "initial editor password")).toThrow();
    expect(users.authenticate("desk", "replacement editor password").id).toBe(editor.id);

    users.setActive(editor.id, false);
    expect(() => users.authenticate("desk", "replacement editor password")).toThrow();
    expect(users.list()).toContainEqual(expect.objectContaining({ id: editor.id, active: false }));

    users.setActive(editor.id, true);
    expect(users.authenticate("desk", "replacement editor password").id).toBe(editor.id);
  });

  it("rejects duplicate usernames and Admin mutation through Editor methods", () => {
    const { users } = fixture();
    const admin = users.bootstrapAdmin("correct local password");
    users.createEditor({
      name: "Front Desk",
      username: "desk",
      password: "initial editor password",
    });

    expect(() =>
      users.createEditor({
        name: "Other Desk",
        username: "DESK",
        password: "another editor password",
      }),
    ).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    expect(() => users.setActive(admin.id, false)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
    expect(() => users.resetEditorPassword(admin.id, "changed admin password")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });
});
