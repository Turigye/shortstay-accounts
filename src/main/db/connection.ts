import Database from "better-sqlite3-multiple-ciphers";

import { migrateDatabase } from "./migrations";

function quotePragmaValue(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function openEncryptedDatabase(
  databasePath: string,
  key: string,
): Database.Database {
  if (key.length === 0) {
    throw new Error("Encryption key must not be empty");
  }

  const database = new Database(databasePath);

  try {
    database.pragma("cipher = 'sqlcipher'");
    database.pragma("legacy = 4");
    database.pragma(`key = ${quotePragmaValue(key)}`);

    // The first read authenticates an existing file before any migrations run.
    database.prepare("select count(*) from sqlite_master").get();
    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");
    migrateDatabase(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
