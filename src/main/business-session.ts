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
import type { AuthenticatedUser, Capability } from "../domain/users";
import { assertCapability } from "./authorization";
import type { CredentialVault } from "./credential-vault";
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
import { createExpenseRepository, type ExpenseRecord, type Supplier, type RecurringExpenseTemplate } from "./db/repositories/expense-repository";
import { createFinanceRepository, type AssetRecord, type FinancialPosition, type InvestmentRecovery, type LoanRecord, type PeriodClose } from "./db/repositories/finance-repository";
import { createDashboardRepository, type TodayOverview } from "./db/repositories/dashboard-repository";
import { backupEncryptedDatabase,restoreEncryptedDatabase,validateEncryptedBackup } from "./backup";
import { exportBusinessWorkbook } from "./export";
import {
  createUserRepository,
  type CreateEditorInput,
  type UserRecord,
  type UserRepository,
} from "./db/repositories/user-repository";
import {
  getReceiptDocument,
  type ReceiptDocument,
} from "./receipt-service";

type ExpenseRepository = ReturnType<typeof createExpenseRepository>;
type FinanceRepository = ReturnType<typeof createFinanceRepository>;
type DashboardRepository = ReturnType<typeof createDashboardRepository>;

function authenticatedUser(user: UserRecord): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}

export type BusinessSessionStatus =
  | { state: "setup" }
  | { state: "databaseLocked" }
  | { state: "profileLocked"; business: BusinessSettings }
  | {
      state: "ready";
      business: BusinessSettings;
      user: AuthenticatedUser;
    };

export type ReadyBusinessSession = Extract<BusinessSessionStatus, { state: "ready" }>;

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
  credentialVault?: CredentialVault;
  openDatabase?: typeof openEncryptedDatabase;
  createRepository?: (database: Database.Database) => BusinessRepository;
  createBookingRepository?: (
    database: Database.Database,
    businessId: string,
    actorUserId?: string | null,
  ) => BookingRepository;
  createPaymentRepository?: (
    database: Database.Database,
    businessId: string,
    actorUserId?: string | null,
  ) => PaymentRepository;
  createCompensationRepository?: (database: Database.Database, businessId: string) => CompensationRepository;
  createExpenseRepository?: (database: Database.Database, businessId: string) => ExpenseRepository;
  createFinanceRepository?: (database: Database.Database, businessId: string) => FinanceRepository;
  createDashboardRepository?: (database: Database.Database, businessId: string) => DashboardRepository;
}

export interface BusinessSession {
  getStatus(): BusinessSessionStatus;
  create(input: CreateBusinessInput): ReadyBusinessSession;
  unlock(password: string): ReadyBusinessSession;
  login(input: { username: string; password: string }): ReadyBusinessSession;
  logout(): void;
  lock(): void;
  getCurrentUser(): AuthenticatedUser | null;
  listUsers(): UserRecord[];
  createEditor(input: CreateEditorInput): UserRecord;
  updateUserIdentity(id: string, input: { name: string; username: string }): UserRecord;
  resetEditorPassword(id: string, password: string): void;
  setUserActive(id: string, active: boolean): UserRecord;
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
  getReceipt(paymentId: string): ReceiptDocument;
  getMonthlyCompensation(month: string): MonthlyCompensationReport;
  recordStaffSettlement(input: Parameters<CompensationRepository["recordStaffSettlement"]>[0]): MonthlyCompensationReport;
  setStaffWorked(input: Parameters<CompensationRepository["setStaffWorked"]>[0]): MonthlyCompensationReport;
  listExpenses(): ExpenseRecord[];
  createExpense(input: Parameters<ExpenseRepository["createExpense"]>[0]): ExpenseRecord;
  listSuppliers(): Supplier[];
  createSupplier(input: Parameters<ExpenseRepository["createSupplier"]>[0]): Supplier;
  recordSupplierPayment(input: Parameters<ExpenseRepository["recordSupplierPayment"]>[0]): ExpenseRecord;
  listRecurringExpenses(month: string): RecurringExpenseTemplate[];
  createRecurringExpense(input: Parameters<ExpenseRepository["createRecurringTemplate"]>[0]): RecurringExpenseTemplate;
  advanceRecurringExpense(id: string): RecurringExpenseTemplate;
  getFinanceOverview(month:string):{position:FinancialPosition;assets:AssetRecord[];loans:LoanRecord[];period:PeriodClose;investmentRecovery:InvestmentRecovery};
  recordBalance(input:Parameters<FinanceRepository["recordBalance"]>[0]):FinancialPosition;
  recordInventory(input:Parameters<FinanceRepository["recordInventory"]>[0]):FinancialPosition;
  createAsset(input:Parameters<FinanceRepository["createAsset"]>[0]):AssetRecord;
  updateAsset(id:string,input:Parameters<FinanceRepository["updateAsset"]>[1]):AssetRecord;
  archiveAsset(id:string):void;
  createLoan(input:Parameters<FinanceRepository["createLoan"]>[0]):LoanRecord;
  updateLoan(id:string,input:Parameters<FinanceRepository["updateLoan"]>[1]):LoanRecord;
  closeMonth(month:string):PeriodClose;
  reopenMonth(month:string,reason:string):PeriodClose;
  getMonthlyFinancialReport(month:string):ReturnType<FinanceRepository["getMonthlyReport"]>;
  getTodayOverview(date:string):TodayOverview;
  backupTo(destination:string,password:string):Promise<void>;
  restoreFrom(source:string,password:string):BusinessSettings;
  exportTo(destination:string,month:string):void;
}

export function createBusinessSession(options: BusinessSessionOptions): BusinessSession {
  const openDatabase = options.openDatabase ?? openEncryptedDatabase;
  const createRepository = options.createRepository ?? createBusinessRepository;
  const createBookings = options.createBookingRepository ?? createBookingRepository;
  const createPayments = options.createPaymentRepository ?? createPaymentRepository;
  const createCompensation = options.createCompensationRepository ?? createCompensationRepository;
  const createExpenses = options.createExpenseRepository ?? createExpenseRepository;
  const createFinance = options.createFinanceRepository ?? createFinanceRepository;
  const createDashboard = options.createDashboardRepository ?? createDashboardRepository;
  let database: Database.Database | undefined;
  let activeUser: AuthenticatedUser | null = null;

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
    return createBookings(database, business.businessId, activeUser?.id ?? null);
  }

  function payments(): PaymentRepository {
    if (!database) {
      throw new BusinessSessionError("LOCKED", "The business file is locked.");
    }
    const business = repository().getSettings();
    if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
    return createPayments(database, business.businessId, activeUser?.id ?? null);
  }

  function users(): UserRepository {
    if (!database) {
      throw new BusinessSessionError("LOCKED", "The business file is locked.");
    }
    const business = repository().getSettings();
    if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
    return createUserRepository(database, business.businessId);
  }

  function requireCapability(capability: Capability): void {
    assertCapability(activeUser, capability);
  }

  function readyStatus(): ReadyBusinessSession {
    if (!activeUser) throw new BusinessSessionError("LOCKED", "A user profile is not signed in.");
    return {
      state: "ready",
      business: repository().getSettings() as BusinessSettings,
      user: activeUser,
    };
  }

  function saveDatabaseSecret(password: string): void {
    try {
      options.credentialVault?.save(password);
    } catch {
      // OS storage is optional; the existing database-password unlock remains available.
    }
  }

  const savedSecret = existsSync(options.databasePath)
    ? options.credentialVault?.load() ?? null
    : null;
  if (savedSecret) {
    try {
      database = openDatabase(options.databasePath, savedSecret);
    } catch {
      database = undefined;
      options.credentialVault?.clear();
    }
  }

  function compensation(): CompensationRepository {
    if (!database) {
      throw new BusinessSessionError("LOCKED", "The business file is locked.");
    }
    const business = repository().getSettings();
    if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
    return createCompensation(database, business.businessId);
  }
  function expenses(): ExpenseRepository {
    if (!database) throw new BusinessSessionError("LOCKED", "The business file is locked.");
    const business = repository().getSettings();
    if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
    return createExpenses(database, business.businessId);
  }
  function finance(): FinanceRepository {
    if (!database) throw new BusinessSessionError("LOCKED", "The business file is locked.");
    const business = repository().getSettings();
    if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
    return createFinance(database, business.businessId);
  }
  function dashboard(): DashboardRepository {
    if (!database) throw new BusinessSessionError("LOCKED", "The business file is locked.");
    const business = repository().getSettings();if(!business)throw new BusinessSessionError("NOT_FOUND","Business settings are missing.");return createDashboard(database,business.businessId);
  }

  function removeIncompleteFile(): void {
    for (const suffix of ["", "-wal", "-shm"]) {
      rmSync(`${options.databasePath}${suffix}`, { force: true });
    }
  }

  const session: BusinessSession = {
    getStatus(): BusinessSessionStatus {
      if (database) {
        const business = repository().getSettings();
        if (!business) return { state: "setup" };
        return activeUser
          ? { state: "ready", business, user: activeUser }
          : { state: "profileLocked", business };
      }
      return existsSync(options.databasePath)
        ? { state: "databaseLocked" }
        : { state: "setup" };
    },

    create(input: CreateBusinessInput): ReadyBusinessSession {
      if (database || existsSync(options.databasePath)) {
        throw new BusinessSessionError("ALREADY_EXISTS", "A local business file already exists.");
      }
      try {
        database = openDatabase(options.databasePath, input.password);
        repository().create(input);
        activeUser = authenticatedUser(users().bootstrapAdmin(input.password));
        saveDatabaseSecret(input.password);
        return readyStatus();
      } catch (error) {
        database?.close();
        database = undefined;
        removeIncompleteFile();
        throw error;
      }
    },

    unlock(password: string): ReadyBusinessSession {
      if (database && activeUser) return readyStatus();
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
        activeUser = authenticatedUser(users().bootstrapAdmin(password));
        saveDatabaseSecret(password);
        return readyStatus();
      } catch {
        opened?.close();
        database = undefined;
        throw new BusinessSessionError(
          "WRONG_PASSWORD",
          "The password was not recognized. Try again.",
        );
      }
    },

    login(input): ReadyBusinessSession {
      activeUser = authenticatedUser(users().authenticate(input.username, input.password));
      return readyStatus();
    },

    logout(): void {
      activeUser = null;
    },

    lock(): void {
      activeUser = null;
      database?.close();
      database = undefined;
    },

    getCurrentUser(): AuthenticatedUser | null {
      return activeUser;
    },

    listUsers(): UserRecord[] {
      requireCapability("users.manage");
      return users().list();
    },

    createEditor(input: CreateEditorInput): UserRecord {
      requireCapability("users.manage");
      return users().createEditor(input);
    },

    updateUserIdentity(
      id: string,
      input: { name: string; username: string },
    ): UserRecord {
      requireCapability("users.manage");
      return users().updateIdentity(id, input);
    },

    resetEditorPassword(id: string, password: string): void {
      requireCapability("users.manage");
      users().resetEditorPassword(id, password);
    },

    setUserActive(id: string, active: boolean): UserRecord {
      requireCapability("users.manage");
      return users().setActive(id, active);
    },

    getSettings(): BusinessSettings {
      const settings = repository().getSettings() as BusinessSettings;
      requireCapability("admin.all");
      return settings;
    },

    manageUnits(input: ManageUnitsInput): BusinessSettings {
      requireCapability("admin.all");
      return repository().manageUnits(input);
    },

    setRate(input: SetRateInput): BusinessSettings {
      requireCapability("admin.all");
      return repository().setRate(input);
    },

    listCustomers(): Customer[] {
      requireCapability("booking.read");
      return bookings().listCustomers();
    },

    createCustomer(input: CustomerInput): Customer {
      requireCapability("booking.create");
      return bookings().createCustomer(input);
    },

    updateCustomer(id: string, input: CustomerInput): Customer {
      requireCapability("booking.update");
      return bookings().updateCustomer(id, input);
    },

    archiveCustomer(id: string): void {
      requireCapability("admin.all");
      bookings().archiveCustomer(id);
    },

    listBookings(filter: BookingListFilter = {}): Booking[] {
      requireCapability("booking.read");
      return bookings().listBookings(filter);
    },

    getBooking(id: string): Booking {
      requireCapability("booking.read");
      return bookings().getBooking(id);
    },

    createBooking(input: BookingInput): Booking {
      requireCapability("booking.create");
      if (activeUser?.role === "editor" && input.initialPayment?.confirmOverpayment) {
        requireCapability("admin.all");
      }
      return bookings().createBooking(input);
    },

    updateBooking(id: string, input: BookingInput): Booking {
      requireCapability("booking.update");
      return bookings().updateBooking(id, input);
    },

    transitionBooking(id: string, status: BookingStatus): Booking {
      requireCapability(status === "cancelled" ? "booking.cancel" : "booking.progress");
      return bookings().transitionBooking(id, status);
    },

    archiveBooking(id: string): void {
      requireCapability("booking.archive");
      bookings().archiveBooking(id);
    },

    listAccounts(): PaymentAccount[] {
      requireCapability("payment.read");
      return payments().listAccounts();
    },

    createAccount(input: AccountInput): PaymentAccount {
      requireCapability("admin.all");
      return payments().createAccount(input);
    },

    updateAccount(id: string, input: AccountInput): PaymentAccount {
      requireCapability("admin.all");
      return payments().updateAccount(id, input);
    },

    archiveAccount(id: string): void {
      requireCapability("admin.all");
      payments().archiveAccount(id);
    },

    listPayments(filter = {}): PaymentMovement[] {
      requireCapability("payment.read");
      return payments().listMovements(filter);
    },

    recordReceipt(input: ReceiptInput): PaymentMovement {
      requireCapability("payment.receipt");
      if (activeUser?.role === "editor" && input.confirmOverpayment) {
        requireCapability("admin.all");
      }
      return payments().recordReceipt(input);
    },

    recordRefund(input: RefundInput): PaymentMovement {
      requireCapability("payment.refund");
      return payments().recordRefund(input);
    },

    recordCorrection(input: CorrectionInput): PaymentMovement {
      requireCapability("payment.correct");
      return payments().recordCorrection(input);
    },

    reversePayment(input: ReversalInput): PaymentMovement {
      requireCapability("payment.reverse");
      return payments().reverseMovement(input);
    },

    getReceipt(paymentId: string): ReceiptDocument {
      requireCapability("receipt.print");
      if (!database) throw new BusinessSessionError("LOCKED", "The business file is locked.");
      const business = repository().getSettings();
      if (!business) throw new BusinessSessionError("NOT_FOUND", "Business settings are missing.");
      return getReceiptDocument(database, business.businessId, paymentId);
    },

    getMonthlyCompensation(month: string): MonthlyCompensationReport {
      requireCapability("admin.all");
      return compensation().getMonthlyReport(month as `${number}-${string}`);
    },
    recordStaffSettlement(input) {
      requireCapability("admin.all");
      return compensation().recordStaffSettlement(input);
    },
    setStaffWorked(input) {
      requireCapability("admin.all");
      return compensation().setStaffWorked(input);
    },
    listExpenses() { requireCapability("admin.all"); return expenses().listExpenses(); },
    createExpense(input) { requireCapability("admin.all"); return expenses().createExpense(input); },
    listSuppliers() { requireCapability("admin.all"); return expenses().listSuppliers(); },
    createSupplier(input) { requireCapability("admin.all"); return expenses().createSupplier(input); },
    recordSupplierPayment(input) { requireCapability("admin.all"); return expenses().recordSupplierPayment(input); },
    listRecurringExpenses(month) { requireCapability("admin.all"); return expenses().listRecurringForReview(month); },
    createRecurringExpense(input) { requireCapability("admin.all"); return expenses().createRecurringTemplate(input); },
    advanceRecurringExpense(id) { requireCapability("admin.all"); return expenses().advanceRecurringTemplate(id); },
    getFinanceOverview(month) { requireCapability("admin.all"); return {position:finance().getPosition(month),assets:finance().listAssets(),loans:finance().listLoans(),period:finance().getPeriodStatus(month),investmentRecovery:finance().getInvestmentRecovery(month)}; },
    recordBalance(input) { requireCapability("admin.all"); return finance().recordBalance(input); },
    recordInventory(input) { requireCapability("admin.all"); return finance().recordInventory(input); },
    createAsset(input) { requireCapability("admin.all"); return finance().createAsset(input); },
    updateAsset(id,input) { requireCapability("admin.all"); return finance().updateAsset(id,input); },
    archiveAsset(id) { requireCapability("admin.all"); return finance().archiveAsset(id); },
    createLoan(input) { requireCapability("admin.all"); return finance().createLoan(input); },
    updateLoan(id,input) { requireCapability("admin.all"); return finance().updateLoan(id,input); },
    closeMonth(month) { requireCapability("admin.all"); return finance().closeMonth(month); },
    reopenMonth(month,reason) { requireCapability("admin.all"); return finance().reopenMonth(month,reason); },
    getMonthlyFinancialReport(month) { requireCapability("admin.all"); return finance().getMonthlyReport(month); },
    getTodayOverview(date) { requireCapability("booking.read"); return dashboard().getToday(date); },
    async backupTo(destination,password){requireCapability("admin.all");if(!database)throw new BusinessSessionError("LOCKED","The business file is locked.");await backupEncryptedDatabase(database,destination,password);},
    restoreFrom(source,password):BusinessSettings{requireCapability("admin.all");validateEncryptedBackup(source,password);activeUser=null;database?.close();database=undefined;restoreEncryptedDatabase(source,options.databasePath,password,{confirmOverwrite:true});database=openDatabase(options.databasePath,password);saveDatabaseSecret(password);return repository().getSettings() as BusinessSettings;},
    exportTo(destination,month):void{requireCapability("admin.all");if(!database)throw new BusinessSessionError("LOCKED","The business file is locked.");const business=repository().getSettings();if(!business)throw new BusinessSessionError("NOT_FOUND","Business settings are missing.");exportBusinessWorkbook(database,business,month,destination);},
  };
  return Object.freeze(session);
}
