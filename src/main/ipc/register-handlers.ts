import {
  BusinessRepositoryError,
} from "../db/repositories/business-repository";
import { BookingRepositoryError } from "../db/repositories/booking-repository";
import { PaymentRepositoryError } from "../db/repositories/payment-repository";
import { UserRepositoryError } from "../db/repositories/user-repository";
import { AuthorizationError } from "../authorization";
import {
  IPC_CHANNELS,
  internalFailure,
  ipcRequestSchema,
  isValidIpcResponse,
  publicFailure,
  validationFailure,
  type IpcChannel,
  type IpcData,
  type IpcPayload,
  type IpcResult,
} from "../../shared/ipc";
import {
  BusinessSessionError,
  type BusinessSession,
} from "../business-session";

type RegisteredListener = (
  event: unknown,
  payload: unknown,
) => Promise<unknown> | unknown;

export interface IpcMainRegistrar {
  handle(channel: string, listener: RegisteredListener): void;
}

export type IpcHandlers = {
  [C in IpcChannel]: (
    payload: IpcPayload<C>,
  ) => IpcData<C> | Promise<IpcData<C>>;
};

const defaultHandlers: IpcHandlers = {
  [IPC_CHANNELS.APP_READY]: () => ({ ready: true }),
  [IPC_CHANNELS.BUSINESS_STATUS]: () => ({ state: "setup" }),
  [IPC_CHANNELS.BUSINESS_CREATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BUSINESS_UNLOCK]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BUSINESS_LOCK]: () => ({ state: "databaseLocked" }),
  [IPC_CHANNELS.PROFILE_LOGIN]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.PROFILE_LOGOUT]: () => ({ state: "profileLocked" }),
  [IPC_CHANNELS.USERS_LIST]: () => [],
  [IPC_CHANNELS.USER_CREATE_EDITOR]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.USER_UPDATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.USER_RESET_PASSWORD]: () => ({ reset: true }),
  [IPC_CHANNELS.USER_SET_ACTIVE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BUSINESS_MANAGE_UNITS]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BUSINESS_SET_RATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.CUSTOMERS_LIST]: () => [],
  [IPC_CHANNELS.CUSTOMER_CREATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.CUSTOMER_UPDATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.CUSTOMER_ARCHIVE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BOOKINGS_LIST]: () => [],
  [IPC_CHANNELS.BOOKING_GET]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BOOKING_CREATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BOOKING_UPDATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BOOKING_TRANSITION]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BOOKING_ARCHIVE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.ACCOUNTS_LIST]: () => [],
  [IPC_CHANNELS.ACCOUNT_CREATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.ACCOUNT_UPDATE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.ACCOUNT_ARCHIVE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.PAYMENTS_LIST]: () => [],
  [IPC_CHANNELS.PAYMENT_RECEIPT]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.PAYMENT_REFUND]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.PAYMENT_CORRECTION]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.PAYMENT_REVERSE]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.RECEIPT_GET]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.RECEIPT_PRINT]: () => {
    throw new Error("Desktop printing is unavailable");
  },
  [IPC_CHANNELS.RECEIPT_EXPORT_PDF]: () => {
    throw new Error("PDF export is unavailable");
  },
  [IPC_CHANNELS.COMPENSATION_MONTHLY]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.EXPENSES_LIST]:()=>[], [IPC_CHANNELS.EXPENSE_CREATE]:()=>{throw new Error("Business session is unavailable");},
  [IPC_CHANNELS.SUPPLIERS_LIST]:()=>[], [IPC_CHANNELS.SUPPLIER_CREATE]:()=>{throw new Error("Business session is unavailable");}, [IPC_CHANNELS.SUPPLIER_PAYMENT]:()=>{throw new Error("Business session is unavailable");},
  [IPC_CHANNELS.RECURRING_EXPENSES_LIST]:()=>[], [IPC_CHANNELS.RECURRING_EXPENSE_CREATE]:()=>{throw new Error("Business session is unavailable");}, [IPC_CHANNELS.RECURRING_EXPENSE_ADVANCE]:()=>{throw new Error("Business session is unavailable");},
  [IPC_CHANNELS.FINANCE_OVERVIEW]:()=>{throw new Error("Business session is unavailable");},[IPC_CHANNELS.BALANCE_SAVE]:()=>{throw new Error("Business session is unavailable");},[IPC_CHANNELS.INVENTORY_SAVE]:()=>{throw new Error("Business session is unavailable");},
  [IPC_CHANNELS.ASSET_CREATE]:()=>{throw new Error("Business session is unavailable");},[IPC_CHANNELS.ASSET_UPDATE]:()=>{throw new Error("Business session is unavailable");},[IPC_CHANNELS.ASSET_ARCHIVE]:()=>{throw new Error("Business session is unavailable");},
  [IPC_CHANNELS.LOAN_CREATE]:()=>{throw new Error("Business session is unavailable");},[IPC_CHANNELS.LOAN_UPDATE]:()=>{throw new Error("Business session is unavailable");},[IPC_CHANNELS.PERIOD_CLOSE]:()=>{throw new Error("Business session is unavailable");},[IPC_CHANNELS.PERIOD_REOPEN]:()=>{throw new Error("Business session is unavailable");},
  [IPC_CHANNELS.REPORT_MONTHLY]:()=>{throw new Error("Business session is unavailable");},
  [IPC_CHANNELS.TODAY_OVERVIEW]:()=>{throw new Error("Business session is unavailable");},
  [IPC_CHANNELS.BACKUP_CREATE]:()=>{throw new Error("Desktop file action is unavailable");},[IPC_CHANNELS.BACKUP_RESTORE]:()=>{throw new Error("Desktop file action is unavailable");},[IPC_CHANNELS.EXPORT_EXCEL]:()=>{throw new Error("Desktop file action is unavailable");},
};

const registeredChannels = [
  IPC_CHANNELS.APP_READY,
  IPC_CHANNELS.BUSINESS_STATUS,
  IPC_CHANNELS.BUSINESS_CREATE,
  IPC_CHANNELS.BUSINESS_UNLOCK,
  IPC_CHANNELS.BUSINESS_LOCK,
  IPC_CHANNELS.PROFILE_LOGIN,
  IPC_CHANNELS.PROFILE_LOGOUT,
  IPC_CHANNELS.USERS_LIST,
  IPC_CHANNELS.USER_CREATE_EDITOR,
  IPC_CHANNELS.USER_UPDATE,
  IPC_CHANNELS.USER_RESET_PASSWORD,
  IPC_CHANNELS.USER_SET_ACTIVE,
  IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
  IPC_CHANNELS.BUSINESS_SET_RATE,
  IPC_CHANNELS.CUSTOMERS_LIST,
  IPC_CHANNELS.CUSTOMER_CREATE,
  IPC_CHANNELS.CUSTOMER_UPDATE,
  IPC_CHANNELS.CUSTOMER_ARCHIVE,
  IPC_CHANNELS.BOOKINGS_LIST,
  IPC_CHANNELS.BOOKING_GET,
  IPC_CHANNELS.BOOKING_CREATE,
  IPC_CHANNELS.BOOKING_UPDATE,
  IPC_CHANNELS.BOOKING_TRANSITION,
  IPC_CHANNELS.BOOKING_ARCHIVE,
  IPC_CHANNELS.ACCOUNTS_LIST,
  IPC_CHANNELS.ACCOUNT_CREATE,
  IPC_CHANNELS.ACCOUNT_UPDATE,
  IPC_CHANNELS.ACCOUNT_ARCHIVE,
  IPC_CHANNELS.PAYMENTS_LIST,
  IPC_CHANNELS.PAYMENT_RECEIPT,
  IPC_CHANNELS.PAYMENT_REFUND,
  IPC_CHANNELS.PAYMENT_CORRECTION,
  IPC_CHANNELS.PAYMENT_REVERSE,
  IPC_CHANNELS.RECEIPT_GET,
  IPC_CHANNELS.RECEIPT_PRINT,
  IPC_CHANNELS.RECEIPT_EXPORT_PDF,
  IPC_CHANNELS.COMPENSATION_MONTHLY,
  IPC_CHANNELS.EXPENSES_LIST,IPC_CHANNELS.EXPENSE_CREATE,IPC_CHANNELS.SUPPLIERS_LIST,IPC_CHANNELS.SUPPLIER_CREATE,IPC_CHANNELS.SUPPLIER_PAYMENT,IPC_CHANNELS.RECURRING_EXPENSES_LIST,IPC_CHANNELS.RECURRING_EXPENSE_CREATE,IPC_CHANNELS.RECURRING_EXPENSE_ADVANCE,
  IPC_CHANNELS.FINANCE_OVERVIEW,IPC_CHANNELS.BALANCE_SAVE,IPC_CHANNELS.INVENTORY_SAVE,IPC_CHANNELS.ASSET_CREATE,IPC_CHANNELS.ASSET_UPDATE,IPC_CHANNELS.ASSET_ARCHIVE,IPC_CHANNELS.LOAN_CREATE,IPC_CHANNELS.LOAN_UPDATE,IPC_CHANNELS.PERIOD_CLOSE,IPC_CHANNELS.PERIOD_REOPEN,
  IPC_CHANNELS.REPORT_MONTHLY,
  IPC_CHANNELS.TODAY_OVERVIEW,
  IPC_CHANNELS.BACKUP_CREATE,IPC_CHANNELS.BACKUP_RESTORE,IPC_CHANNELS.EXPORT_EXCEL,
] as const;

export function createBusinessIpcHandlers(
  session: BusinessSession,
): Partial<IpcHandlers> {
  return {
    [IPC_CHANNELS.BUSINESS_STATUS]: () => session.getStatus(),
    [IPC_CHANNELS.BUSINESS_CREATE]: (payload) => session.create(payload),
    [IPC_CHANNELS.BUSINESS_UNLOCK]: ({ password }) => session.unlock(password),
    [IPC_CHANNELS.BUSINESS_LOCK]: () => {
      session.lock();
      return { state: "databaseLocked" };
    },
    [IPC_CHANNELS.PROFILE_LOGIN]: (payload) => session.login(payload),
    [IPC_CHANNELS.PROFILE_LOGOUT]: () => {
      session.logout();
      return { state: "profileLocked" };
    },
    [IPC_CHANNELS.USERS_LIST]: () => session.listUsers(),
    [IPC_CHANNELS.USER_CREATE_EDITOR]: (payload) => session.createEditor(payload),
    [IPC_CHANNELS.USER_UPDATE]: ({ id, ...payload }) =>
      session.updateUserIdentity(id, payload),
    [IPC_CHANNELS.USER_RESET_PASSWORD]: ({ id, password }) => {
      session.resetEditorPassword(id, password);
      return { reset: true };
    },
    [IPC_CHANNELS.USER_SET_ACTIVE]: ({ id, active }) =>
      session.setUserActive(id, active),
    [IPC_CHANNELS.BUSINESS_MANAGE_UNITS]: (payload) => session.manageUnits(payload),
    [IPC_CHANNELS.BUSINESS_SET_RATE]: (payload) => session.setRate(payload),
    [IPC_CHANNELS.CUSTOMERS_LIST]: () => session.listCustomers(),
    [IPC_CHANNELS.CUSTOMER_CREATE]: (payload) => session.createCustomer(payload),
    [IPC_CHANNELS.CUSTOMER_UPDATE]: ({ id, ...payload }) =>
      session.updateCustomer(id, payload),
    [IPC_CHANNELS.CUSTOMER_ARCHIVE]: ({ id }) => {
      session.archiveCustomer(id);
      return { archived: true };
    },
    [IPC_CHANNELS.BOOKINGS_LIST]: (payload) => session.listBookings(payload),
    [IPC_CHANNELS.BOOKING_GET]: ({ id }) => session.getBooking(id),
    [IPC_CHANNELS.BOOKING_CREATE]: (payload) => session.createBooking(payload),
    [IPC_CHANNELS.BOOKING_UPDATE]: ({ id, ...payload }) =>
      session.updateBooking(id, payload),
    [IPC_CHANNELS.BOOKING_TRANSITION]: ({ id, status }) =>
      session.transitionBooking(id, status),
    [IPC_CHANNELS.BOOKING_ARCHIVE]: ({ id }) => {
      session.archiveBooking(id);
      return { archived: true };
    },
    [IPC_CHANNELS.ACCOUNTS_LIST]: () => session.listAccounts(),
    [IPC_CHANNELS.ACCOUNT_CREATE]: (payload) => session.createAccount(payload),
    [IPC_CHANNELS.ACCOUNT_UPDATE]: ({ id, ...payload }) => session.updateAccount(id, payload),
    [IPC_CHANNELS.ACCOUNT_ARCHIVE]: ({ id }) => {
      session.archiveAccount(id);
      return { archived: true };
    },
    [IPC_CHANNELS.PAYMENTS_LIST]: (payload) => session.listPayments(payload),
    [IPC_CHANNELS.PAYMENT_RECEIPT]: (payload) => session.recordReceipt(payload),
    [IPC_CHANNELS.PAYMENT_REFUND]: (payload) => session.recordRefund(payload),
    [IPC_CHANNELS.PAYMENT_CORRECTION]: (payload) => session.recordCorrection(payload),
    [IPC_CHANNELS.PAYMENT_REVERSE]: (payload) => session.reversePayment(payload),
    [IPC_CHANNELS.RECEIPT_GET]: ({ paymentId }) => session.getReceipt(paymentId),
    [IPC_CHANNELS.COMPENSATION_MONTHLY]: ({ month }) =>
      session.getMonthlyCompensation(month),
    [IPC_CHANNELS.EXPENSES_LIST]:()=>session.listExpenses(), [IPC_CHANNELS.EXPENSE_CREATE]:(payload)=>session.createExpense(payload),
    [IPC_CHANNELS.SUPPLIERS_LIST]:()=>session.listSuppliers(), [IPC_CHANNELS.SUPPLIER_CREATE]:(payload)=>session.createSupplier(payload), [IPC_CHANNELS.SUPPLIER_PAYMENT]:(payload)=>session.recordSupplierPayment(payload),
    [IPC_CHANNELS.RECURRING_EXPENSES_LIST]:({month})=>session.listRecurringExpenses(month), [IPC_CHANNELS.RECURRING_EXPENSE_CREATE]:(payload)=>session.createRecurringExpense(payload), [IPC_CHANNELS.RECURRING_EXPENSE_ADVANCE]:({id})=>session.advanceRecurringExpense(id),
    [IPC_CHANNELS.FINANCE_OVERVIEW]:({month})=>session.getFinanceOverview(month),[IPC_CHANNELS.BALANCE_SAVE]:(payload)=>session.recordBalance(payload),[IPC_CHANNELS.INVENTORY_SAVE]:(payload)=>session.recordInventory(payload),
    [IPC_CHANNELS.ASSET_CREATE]:(payload)=>session.createAsset(payload),[IPC_CHANNELS.ASSET_UPDATE]:({id,...payload})=>session.updateAsset(id,payload),[IPC_CHANNELS.ASSET_ARCHIVE]:({id})=>{session.archiveAsset(id);return{archived:true as const};},
    [IPC_CHANNELS.LOAN_CREATE]:(payload)=>session.createLoan(payload),[IPC_CHANNELS.LOAN_UPDATE]:({id,...payload})=>session.updateLoan(id,payload),[IPC_CHANNELS.PERIOD_CLOSE]:({month})=>session.closeMonth(month),[IPC_CHANNELS.PERIOD_REOPEN]:({month,reason})=>session.reopenMonth(month,reason),
    [IPC_CHANNELS.REPORT_MONTHLY]:({month})=>session.getMonthlyFinancialReport(month),
    [IPC_CHANNELS.TODAY_OVERVIEW]:({date})=>session.getTodayOverview(date),
  };
}

export function registerIpcHandlers(
  ipcMain: IpcMainRegistrar,
  overrides: Partial<IpcHandlers> = {},
): void {
  const handlers = { ...defaultHandlers, ...overrides };

  for (const channel of registeredChannels) {
    ipcMain.handle(channel, async (_event, payload) => {
      const request = ipcRequestSchema.safeParse({ channel, payload });
      if (!request.success) return validationFailure(request.error);

      try {
        const handler = handlers[channel] as (
          input: IpcPayload<typeof channel>,
        ) => IpcData<typeof channel> | Promise<IpcData<typeof channel>>;
        const result: IpcResult<typeof channel> = {
          ok: true,
          data: await handler(request.data.payload),
        };

        return isValidIpcResponse(channel, result)
          ? result
          : internalFailure("INVALID_RESPONSE");
      } catch (error) {
        if (error instanceof BusinessSessionError) {
          return publicFailure(error.code, error.message);
        }
        if (error instanceof BusinessRepositoryError) {
          return publicFailure(error.code, error.message, error.fieldErrors);
        }
        if (error instanceof BookingRepositoryError) {
          return publicFailure(error.code, error.message, error.fieldErrors);
        }
        if (error instanceof PaymentRepositoryError) {
          return publicFailure(error.code, error.message, error.fieldErrors);
        }
        if (error instanceof UserRepositoryError) {
          return publicFailure(error.code, error.message);
        }
        if (error instanceof AuthorizationError) {
          return publicFailure(error.code, error.message);
        }
        console.error(`[IPC] ${channel} failed`, error);
        return internalFailure();
      }
    });
  }
}
