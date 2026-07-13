import { existsSync, rmSync } from "node:fs";

import type Database from "better-sqlite3-multiple-ciphers";

import type { BusinessSettings } from "../domain/types";
import { openEncryptedDatabase } from "./db/connection";
import {
  createBusinessRepository,
  type BusinessRepository,
  type CreateBusinessInput,
  type ManageUnitsInput,
  type SetRateInput,
} from "./db/repositories/business-repository";

export type BusinessSessionStatus =
  | { state: "setup" }
  | { state: "locked" }
  | { state: "ready"; business: BusinessSettings };

export class BusinessSessionError extends Error {
  constructor(
    readonly code: "WRONG_PASSWORD" | "LOCKED" | "NOT_FOUND" | "ALREADY_EXISTS",
    message: string,
  ) {
    super(message);
    this.name = "BusinessSessionError";
  }
}

interface BusinessSessionOptions {
  databasePath: string;
  openDatabase?: typeof openEncryptedDatabase;
  createRepository?: (database: Database.Database) => BusinessRepository;
}

export interface BusinessSession {
  getStatus(): BusinessSessionStatus;
  create(input: CreateBusinessInput): BusinessSettings;
  unlock(password: string): BusinessSettings;
  lock(): void;
  getSettings(): BusinessSettings;
  manageUnits(input: ManageUnitsInput): BusinessSettings;
  setRate(input: SetRateInput): BusinessSettings;
}

export function createBusinessSession(options: BusinessSessionOptions): BusinessSession {
  const openDatabase = options.openDatabase ?? openEncryptedDatabase;
  const createRepository = options.createRepository ?? createBusinessRepository;
  let database: Database.Database | undefined;

  function repository() {
    if (!database) {
      throw new BusinessSessionError("LOCKED", "The business file is locked.");
    }
    return createRepository(database);
  }

  function removeIncompleteFile(): void {
    for (const suffix of ["", "-wal", "-shm"]) {
      rmSync(`${options.databasePath}${suffix}`, { force: true });
    }
  }

  return Object.freeze({
    getStatus(): BusinessSessionStatus {
      if (database) {
        const business = repository().getSettings();
        return business ? { state: "ready", business } : { state: "setup" };
      }
      return existsSync(options.databasePath) ? { state: "locked" } : { state: "setup" };
    },

    create(input: CreateBusinessInput): BusinessSettings {
      if (database || existsSync(options.databasePath)) {
        throw new BusinessSessionError("ALREADY_EXISTS", "A local business file already exists.");
      }
      try {
        database = openDatabase(options.databasePath, input.password);
        return repository().create(input);
      } catch (error) {
        database?.close();
        database = undefined;
        removeIncompleteFile();
        throw error;
      }
    },

    unlock(password: string): BusinessSettings {
      if (database) return repository().getSettings() as BusinessSettings;
      if (!existsSync(options.databasePath)) {
        throw new BusinessSessionError("NOT_FOUND", "No local business file was found.");
      }
      let opened: Database.Database | undefined;
      try {
        opened = openDatabase(options.databasePath, password);
        const unlockedRepository = createRepository(opened);
        const business = unlockedRepository.getSettings();
        if (!business) {
          throw new Error("Business settings are missing");
        }
        database = opened;
        opened = undefined;
        return business;
      } catch {
        opened?.close();
        database = undefined;
        throw new BusinessSessionError(
          "WRONG_PASSWORD",
          "The password was not recognized. Try again.",
        );
      }
    },

    lock(): void {
      database?.close();
      database = undefined;
    },

    getSettings(): BusinessSettings {
      return repository().getSettings() as BusinessSettings;
    },

    manageUnits(input: ManageUnitsInput): BusinessSettings {
      return repository().manageUnits(input);
    },

    setRate(input: SetRateInput): BusinessSettings {
      return repository().setRate(input);
    },
  });
}
