import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";

import type {
  AuthenticatedUser,
  UserProfile,
  UserRole,
} from "../../../domain/users";

const PASSWORD_BYTES = 64;
const MINIMUM_PASSWORD_LENGTH = 10;

export type UserRecord = UserProfile;

export interface CreateEditorInput {
  readonly name: string;
  readonly username: string;
  readonly password: string;
}

export interface UserRepository {
  bootstrapAdmin(password: string): UserRecord;
  authenticate(username: string, password: string): UserRecord;
  list(): UserRecord[];
  createEditor(input: CreateEditorInput): UserRecord;
  updateIdentity(id: string, input: { name: string; username: string }): UserRecord;
  resetEditorPassword(id: string, password: string): void;
  setActive(id: string, active: boolean): UserRecord;
}

export class UserRepositoryError extends Error {
  constructor(
    readonly code:
      | "AUTHENTICATION_FAILED"
      | "CONFLICT"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "UserRepositoryError";
  }
}

interface UserRow {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  password_salt: string;
  password_hash: string;
  active: number;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new UserRepositoryError("VALIDATION_ERROR", `${label} is required.`);
  }
  return normalized;
}

function validatePassword(password: string): void {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new UserRepositoryError(
      "VALIDATION_ERROR",
      `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
    );
  }
}

function passwordDigest(password: string, salt: string): string {
  return scryptSync(
    password,
    Buffer.from(salt, "base64"),
    PASSWORD_BYTES,
  ).toString("base64");
}

function passwordFields(password: string): {
  passwordSalt: string;
  passwordHash: string;
} {
  validatePassword(password);
  const passwordSalt = randomBytes(16).toString("base64");
  return {
    passwordSalt,
    passwordHash: passwordDigest(password, passwordSalt),
  };
}

function mapUser(row: UserRow): UserRecord {
  return Object.freeze({
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    active: row.active === 1,
  });
}

export function createUserRepository(
  database: Database.Database,
  businessId: string,
): UserRepository {
  const findById = database.prepare<[string, string], UserRow>(`
    SELECT id, name, username, role, password_salt, password_hash, active
    FROM users
    WHERE id = ? AND business_id = ?
  `);
  const findByUsername = database.prepare<[string, string], UserRow>(`
    SELECT id, name, username, role, password_salt, password_hash, active
    FROM users
    WHERE username = ? COLLATE NOCASE AND business_id = ?
  `);

  function requireUser(id: string): UserRow {
    const row = findById.get(id, businessId);
    if (!row) throw new UserRepositoryError("NOT_FOUND", "User profile was not found.");
    return row;
  }

  function requireEditor(id: string): UserRow {
    const row = requireUser(id);
    if (row.role !== "editor") {
      throw new UserRepositoryError(
        "FORBIDDEN",
        "Only Editor profiles can be changed here.",
      );
    }
    return row;
  }

  function translateConflict(error: unknown): never {
    if (
      error instanceof Error &&
      error.message.toLocaleLowerCase().includes("unique")
    ) {
      throw new UserRepositoryError("CONFLICT", "That username is already in use.");
    }
    throw error;
  }

  return Object.freeze({
    bootstrapAdmin(password: string): UserRecord {
      const existing = database
        .prepare<[string], UserRow>(`
          SELECT id, name, username, role, password_salt, password_hash, active
          FROM users
          WHERE business_id = ? AND role = 'admin'
          ORDER BY created_at, id
          LIMIT 1
        `)
        .get(businessId);
      if (existing) return mapUser(existing);

      const { passwordSalt, passwordHash } = passwordFields(password);
      database.prepare(`
        INSERT INTO users (
          business_id, name, username, role, password_salt, password_hash
        ) VALUES (?, 'Owner', 'admin', 'admin', ?, ?)
      `).run(businessId, passwordSalt, passwordHash);
      return mapUser(findByUsername.get("admin", businessId) as UserRow);
    },

    authenticate(username: string, password: string): UserRecord {
      const genericFailure = () =>
        new UserRepositoryError(
          "AUTHENTICATION_FAILED",
          "The username or password was not recognized.",
        );
      const row = findByUsername.get(username.trim(), businessId);
      if (!row || row.active !== 1) throw genericFailure();

      const actual = Buffer.from(passwordDigest(password, row.password_salt), "base64");
      const expected = Buffer.from(row.password_hash, "base64");
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw genericFailure();
      }
      return mapUser(row);
    },

    list(): UserRecord[] {
      return database
        .prepare<[string], UserRow>(`
          SELECT id, name, username, role, password_salt, password_hash, active
          FROM users
          WHERE business_id = ?
          ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, name, username
        `)
        .all(businessId)
        .map(mapUser);
    },

    createEditor(input: CreateEditorInput): UserRecord {
      const name = requiredText(input.name, "Name");
      const username = requiredText(input.username, "Username");
      const { passwordSalt, passwordHash } = passwordFields(input.password);
      try {
        database.prepare(`
          INSERT INTO users (
            business_id, name, username, role, password_salt, password_hash
          ) VALUES (?, ?, ?, 'editor', ?, ?)
        `).run(businessId, name, username, passwordSalt, passwordHash);
      } catch (error) {
        translateConflict(error);
      }
      return mapUser(findByUsername.get(username, businessId) as UserRow);
    },

    updateIdentity(
      id: string,
      input: { name: string; username: string },
    ): UserRecord {
      requireUser(id);
      const name = requiredText(input.name, "Name");
      const username = requiredText(input.username, "Username");
      try {
        database.prepare(`
          UPDATE users SET name = ?, username = ?
          WHERE id = ? AND business_id = ?
        `).run(name, username, id, businessId);
      } catch (error) {
        translateConflict(error);
      }
      return mapUser(requireUser(id));
    },

    resetEditorPassword(id: string, password: string): void {
      requireEditor(id);
      const { passwordSalt, passwordHash } = passwordFields(password);
      database.prepare(`
        UPDATE users SET password_salt = ?, password_hash = ?
        WHERE id = ? AND business_id = ?
      `).run(passwordSalt, passwordHash, id, businessId);
    },

    setActive(id: string, active: boolean): UserRecord {
      requireEditor(id);
      database.prepare(`
        UPDATE users SET active = ? WHERE id = ? AND business_id = ?
      `).run(active ? 1 : 0, id, businessId);
      return mapUser(requireUser(id));
    },
  });
}
