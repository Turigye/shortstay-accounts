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
import {
  createBookingRepository,
  type BookingInput,
  type BookingListFilter,
  type BookingRepository,
  type CustomerInput,
} from "./db/repositories/booking-repository";
import type { Booking, Customer } from "../domain/bookings";
import type { BookingStatus } from "../domain/types";
import {
  createPaymentRepository,
  type AccountInput,
  type CorrectionInput,
  type PaymentAccount,
  type PaymentMovement,
  type PaymentRepository,
  type ReceiptInput,
  type RefundInput,
  type ReversalInput,
} from "./db/repositories/payment-repository";
import {
  createCompensationRepository,
  type CompensationRepository,
  type MonthlyCompensationReport,
} from "./db/repositories/compensation-repository";

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
  createBookingRepository?: (database: Database.Database, businessId: string) => BookingRepository;
  createPaymentRepository?: (database: Database.Database, businessId: string) => PaymentRepository;
  createCompensationRepository?: (database: Database.Database, businessId: string) => CompensationRepository;
}

export interface BusinessSession {
  getStatus(): BusinessSessionStatus;
  create(input: CreateBusinessInput): BusinessSettings;
  unlock(password: string): BusinessSettings;
  lock(): void;
  getSettings(): BusinessSettings;
  manageUnits(input: ManageUnitsInput): BusinessSettings;
  setRate(input: SetRateInput): BusinessSettings;
  listCustomers(): Customer[];
  createCustomer(input: CustomerInput): Customer;
  updateCustomer(id: string, input: CustomerInput): Customer;
  archiveCustomer(id: string): void;
  listBookings(filter?: BookingListFilter): Booking[];
  getBooking(id: string): Booking;
  createBooking(input: BookingInput): Booking;
  updateBooking(id: string, input: BookingInput): Booking;
  transitionBooking(id: string, status: BookingStatus): Booking;
  archiveBooking(id: string): void;
  listAccounts(): PaymentAccount[];
  createAccount(input: AccountInput): PaymentAccount;
  updateAccount(id: string, input: AccountInput): PaymentAccount;
  archiveAccount(id: string): void;
  listPayments(filter?: { readonly bookingId?: string }): PaymentMovement[];
  recordReceipt(input: ReceiptInput): PaymentMovement;
  recordRefund(input: RefundInput): PaymentMovement;
  recordCorrection(input: CorrectionInput): PaymentMovement;
  reversePayment(input: ReversalInput): PaymentMovement;
  getMonthlyCompensation(month: string): MonthlyCompensationReport;
}

export function createBusinessSession(options: BusinessSessionOptions): BusinessSession {
  const openDatabase = options.openDatabase ?? openEncryptedDatabase;
  const createRepository = options.createRepository ?? createBusinessRepository;
  const createBookings = options.createBookingRepository ?? createBookingRepository;
  const createPayments = options.createPaymentRepository ?? createPaymentRepository;
  const createCompensation = options.createCompensationRepository ?? createCompensationRepository;
  let database: Database.Database | undefined;

  function repository() {
    if (!database) {
      throw new BusinessSessionError("LOCKED", "The business file is locked.");
    }
    return createRepository(database);
  }

  function bookings(): BookingRepository {
    if (!database) {
      throw new BusinessSessionError("LOCKED", "The business file is locked.");
    }
    const business = repository().getSettings();
    if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
    return createBookings(database, business.businessId);
  }

  function payments(): PaymentRepository {
    if (!database) {
      throw new BusinessSessionError("LOCKED", "The business file is locked.");
    }
    const business = repository().getSettings();
    if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
    return createPayments(database, business.businessId);
  }

  function compensation(): CompensationRepository {
    if (!database) {
      throw new BusinessSessionError("LOCKED", "The business file is locked.");
    }
    const business = repository().getSettings();
    if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
    return createCompensation(database, business.businessId);
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

    listCustomers(): Customer[] {
      return bookings().listCustomers();
    },

    createCustomer(input: CustomerInput): Customer {
      return bookings().createCustomer(input);
    },

    updateCustomer(id: string, input: CustomerInput): Customer {
      return bookings().updateCustomer(id, input);
    },

    archiveCustomer(id: string): void {
      bookings().archiveCustomer(id);
    },

    listBookings(filter: BookingListFilter = {}): Booking[] {
      return bookings().listBookings(filter);
    },

    getBooking(id: string): Booking {
      return bookings().getBooking(id);
    },

    createBooking(input: BookingInput): Booking {
      return bookings().createBooking(input);
    },

    updateBooking(id: string, input: BookingInput): Booking {
      return bookings().updateBooking(id, input);
    },

    transitionBooking(id: string, status: BookingStatus): Booking {
      return bookings().transitionBooking(id, status);
    },

    archiveBooking(id: string): void {
      bookings().archiveBooking(id);
    },

    listAccounts(): PaymentAccount[] {
      return payments().listAccounts();
    },

    createAccount(input: AccountInput): PaymentAccount {
      return payments().createAccount(input);
    },

    updateAccount(id: string, input: AccountInput): PaymentAccount {
      return payments().updateAccount(id, input);
    },

    archiveAccount(id: string): void {
      payments().archiveAccount(id);
    },

    listPayments(filter = {}): PaymentMovement[] {
      return payments().listMovements(filter);
    },

    recordReceipt(input: ReceiptInput): PaymentMovement {
      return payments().recordReceipt(input);
    },

    recordRefund(input: RefundInput): PaymentMovement {
      return payments().recordRefund(input);
    },

    recordCorrection(input: CorrectionInput): PaymentMovement {
      return payments().recordCorrection(input);
    },

    reversePayment(input: ReversalInput): PaymentMovement {
      return payments().reverseMovement(input);
    },

    getMonthlyCompensation(month: string): MonthlyCompensationReport {
      return compensation().getMonthlyReport(month as `${number}-${string}`);
    },
  });
}
