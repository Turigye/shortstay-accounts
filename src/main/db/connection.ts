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
    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");

    // The first explicit schema read authenticates before migrations run.
    database.prepare("select count(*) from sqlite_master").get();
    migrateDatabase(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
