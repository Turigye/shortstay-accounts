import { z } from "zod";

import type { Booking, Customer } from "../domain/bookings";
import type { BusinessSettings, RoleKey } from "../domain/types";
import type {
  PaymentAccount,
  PaymentMovement,
} from "../main/db/repositories/payment-repository";
import type { MonthlyCompensationReport } from "../main/db/repositories/compensation-repository";
import type { ExpenseRecord, RecurringExpenseTemplate, Supplier } from "../main/db/repositories/expense-repository";
import type { AssetRecord, FinancialPosition, LoanRecord, PeriodClose } from "../main/db/repositories/finance-repository";

export const IPC_CHANNELS = {
  APP_READY: "app:ready",
  BUSINESS_STATUS: "business:status",
  BUSINESS_CREATE: "business:create",
  BUSINESS_UNLOCK: "business:unlock",
  BUSINESS_LOCK: "business:lock",
  BUSINESS_MANAGE_UNITS: "business:manage-units",
  BUSINESS_SET_RATE: "business:set-rate",
  CUSTOMERS_LIST: "customers:list",
  CUSTOMER_CREATE: "customers:create",
  CUSTOMER_UPDATE: "customers:update",
  CUSTOMER_ARCHIVE: "customers:archive",
  BOOKINGS_LIST: "bookings:list",
  BOOKING_GET: "bookings:get",
  BOOKING_CREATE: "bookings:create",
  BOOKING_UPDATE: "bookings:update",
  BOOKING_TRANSITION: "bookings:transition",
  BOOKING_ARCHIVE: "bookings:archive",
  ACCOUNTS_LIST: "accounts:list",
  ACCOUNT_CREATE: "accounts:create",
  ACCOUNT_UPDATE: "accounts:update",
  ACCOUNT_ARCHIVE: "accounts:archive",
  PAYMENTS_LIST: "payments:list",
  PAYMENT_RECEIPT: "payments:receipt",
  PAYMENT_REFUND: "payments:refund",
  PAYMENT_CORRECTION: "payments:correction",
  PAYMENT_REVERSE: "payments:reverse",
  COMPENSATION_MONTHLY: "compensation:monthly",
  EXPENSES_LIST: "expenses:list", EXPENSE_CREATE: "expenses:create",
  SUPPLIERS_LIST: "suppliers:list", SUPPLIER_CREATE: "suppliers:create", SUPPLIER_PAYMENT: "suppliers:payment",
  RECURRING_EXPENSES_LIST: "recurring-expenses:list", RECURRING_EXPENSE_CREATE: "recurring-expenses:create",
  FINANCE_OVERVIEW: "finance:overview", BALANCE_SAVE: "finance:balance-save", INVENTORY_SAVE: "finance:inventory-save",
  ASSET_CREATE: "finance:asset-create", LOAN_CREATE: "finance:loan-create",
  PERIOD_CLOSE: "finance:period-close", PERIOD_REOPEN: "finance:period-reopen",
} as const;

const roleSchema = z.enum([
  "operations",
  "salesMarketing",
  "finance",
  "itLegal",
  "security",
  "ceo",
]);
function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

const dateSchema = z.string().refine(isIsoCalendarDate, {
  message: "Enter a valid calendar date in YYYY-MM-DD format.",
});
const passwordSchema = z.string().min(1).max(1024);
const unitNameSchema = z.string().trim().min(1).max(120);
const unitNamesSchema = z
  .tuple([unitNameSchema, unitNameSchema])
  .superRefine((unitNames, context) => {
    if (unitNames[0].toLocaleLowerCase() === unitNames[1].toLocaleLowerCase()) {
      context.addIssue({
        code: "custom",
        message: "Initial unit names must be different.",
        path: [1],
      });
    }
  });

const appReadyRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.APP_READY), payload: z.object({}).strict() })
  .strict();
const businessStatusRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.BUSINESS_STATUS), payload: z.object({}).strict() })
  .strict();
const businessCreateRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BUSINESS_CREATE),
    payload: z
      .object({
        name: z.string().trim().min(1).max(160),
        unitNames: unitNamesSchema,
        password: passwordSchema.min(10),
      })
      .strict(),
  })
  .strict();
const businessUnlockRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BUSINESS_UNLOCK),
    payload: z.object({ password: passwordSchema }).strict(),
  })
  .strict();
const businessLockRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.BUSINESS_LOCK), payload: z.object({}).strict() })
  .strict();
const manageUnitsRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BUSINESS_MANAGE_UNITS),
    payload: z
      .object({
        units: z
          .array(
            z
              .object({
                id: z.string().min(1).optional(),
                name: unitNameSchema,
              })
              .strict(),
          )
          .min(1)
          .superRefine((units, context) => {
            const seen = new Set<string>();
            units.forEach(({ name }, index) => {
              const normalized = name.toLocaleLowerCase();
              if (seen.has(normalized)) {
                context.addIssue({
                  code: "custom",
                  message: "Active unit names must be different.",
                  path: [index, "name"],
                });
              }
              seen.add(normalized);
            });
          }),
      })
      .strict(),
  })
  .strict();
const staffRateRequestSchema = z
  .object({
    kind: z.literal("staff"),
    role: roleSchema,
    value: z.number().min(0).max(100),
    effectiveFrom: dateSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
const referralRateRequestSchema = z
  .object({
    kind: z.literal("referral"),
    value: z
      .number()
      .refine(Number.isFinite, { message: "Referral rate must be finite." })
      .min(0)
      .max(100),
    effectiveFrom: dateSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
const taxProvisionRateRequestSchema = z
  .object({
    kind: z.literal("taxProvision"),
    value: z
      .number()
      .nonnegative()
      .refine(Number.isSafeInteger, {
        message: "Tax provision must be a whole safe-integer UGX amount.",
      }),
    effectiveFrom: dateSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
const setRateRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BUSINESS_SET_RATE),
    payload: z.discriminatedUnion("kind", [
      staffRateRequestSchema,
      referralRateRequestSchema,
      taxProvisionRateRequestSchema,
    ]),
  })
  .strict();

const bookingStatusSchema = z.enum([
  "draft",
  "confirmed",
  "checkedIn",
  "completed",
  "cancelled",
]);
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, {
  message: "Enter a valid time in HH:MM format.",
});
const wholeUgxSchema = z.number().refine(Number.isSafeInteger, {
  message: "Enter a whole safe-integer UGX amount.",
});
const positiveWholeUgxSchema = wholeUgxSchema.positive();
const idSchema = z.string().trim().min(1).max(160);
const paymentMethodSchema = z.enum(["cash", "mobileMoney", "bankTransfer", "card"]);
const paymentAccountTypeSchema = z.enum(["cash", "bank", "mobileMoney", "card"]);
const paymentDirectionSchema = z.enum(["receipt", "refund"]);
const paymentRecordTypeSchema = z.enum(["receipt", "refund", "reversal", "correction"]);
const paymentStateSchema = z.enum([
  "unpaid",
  "partiallyPaid",
  "fullyPaid",
  "overpaid",
  "partiallyRefunded",
  "fullyRefunded",
]);
const dateTimeSchema = z.string().refine((value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    calendarDate.getUTCFullYear() === Number(year) &&
    calendarDate.getUTCMonth() === Number(month) - 1 &&
    calendarDate.getUTCDate() === Number(day) &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}, { message: "Enter a valid ISO payment date and time." });
const paymentDraftSchema = z
  .object({
    amount: positiveWholeUgxSchema,
    paidAt: dateTimeSchema,
    method: paymentMethodSchema,
    accountId: idSchema,
    reference: z.string().trim().max(500).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strict();
const initialPaymentSchema = paymentDraftSchema
  .extend({ confirmOverpayment: z.boolean().optional() })
  .strict();
const customerInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();
const customersListRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.CUSTOMERS_LIST), payload: z.object({}).strict() })
  .strict();
const customerCreateRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.CUSTOMER_CREATE), payload: customerInputSchema })
  .strict();
const customerUpdateRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.CUSTOMER_UPDATE),
    payload: customerInputSchema.extend({ id: z.string().min(1) }).strict(),
  })
  .strict();
const customerArchiveRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.CUSTOMER_ARCHIVE),
    payload: z.object({ id: z.string().min(1) }).strict(),
  })
  .strict();
const bookingInputShape = {
    unitId: z.string().min(1),
    customerId: z.string().min(1),
    checkIn: dateSchema,
    checkOut: dateSchema,
    checkInTime: timeSchema.optional(),
    checkOutTime: timeSchema.optional(),
    nightlyRate: wholeUgxSchema.nonnegative(),
    adjustment: wholeUgxSchema.optional(),
    status: bookingStatusSchema.optional(),
    referred: z.boolean().optional(),
    referrerId: z.string().min(1).nullable().optional(),
    referrerName: z.string().trim().max(160).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
} as const;

function validateReferralInput(
  input: { referred?: boolean; referrerId?: string | null; referrerName?: string | null },
  context: z.RefinementCtx,
): void {
    const hasReferrerId = Boolean(input.referrerId);
    const hasReferrerName = Boolean(input.referrerName?.trim());

    if (input.referred !== true) {
      if (hasReferrerId) {
        context.addIssue({
          code: "custom",
          message: "Remove the referrer ID or mark this as a referral booking.",
          path: ["referrerId"],
        });
      }
      if (hasReferrerName) {
        context.addIssue({
          code: "custom",
          message: "Remove the referrer name or mark this as a referral booking.",
          path: ["referrerName"],
        });
      }
      return;
    }

    if (hasReferrerId === hasReferrerName) {
      context.addIssue({
        code: "custom",
        message: hasReferrerId
          ? "Choose an existing referrer or enter a new name, not both."
          : "Choose an existing referrer or enter a new name.",
        path: ["referrerName"],
      });
    }
}

const bookingInputSchema = z
  .object({ ...bookingInputShape, initialPayment: initialPaymentSchema.optional() })
  .strict()
  .superRefine(validateReferralInput);
const bookingUpdateInputSchema = z
  .object({ ...bookingInputShape, id: z.string().min(1) })
  .strict()
  .superRefine(validateReferralInput);
const bookingsListRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BOOKINGS_LIST),
    payload: z
      .object({
        status: bookingStatusSchema.optional(),
        unitId: z.string().min(1).optional(),
        customerId: z.string().min(1).optional(),
        query: z.string().trim().max(160).optional(),
        scheduleFrom: dateSchema.optional(),
        scheduleTo: dateSchema.optional(),
        balance: z.enum(["unpaid", "outstanding", "paid"]).optional(),
      })
      .strict(),
  })
  .strict();
const bookingGetRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BOOKING_GET),
    payload: z.object({ id: z.string().min(1) }).strict(),
  })
  .strict();
const bookingCreateRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.BOOKING_CREATE), payload: bookingInputSchema })
  .strict();
const bookingUpdateRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BOOKING_UPDATE),
    payload: bookingUpdateInputSchema,
  })
  .strict();
const bookingTransitionRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BOOKING_TRANSITION),
    payload: z.object({ id: z.string().min(1), status: bookingStatusSchema }).strict(),
  })
  .strict();
const bookingArchiveRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BOOKING_ARCHIVE),
    payload: z.object({ id: z.string().min(1) }).strict(),
  })
  .strict();

const accountInputSchema = z
  .object({ name: z.string().trim().min(1).max(160), type: paymentAccountTypeSchema })
  .strict();
const accountsListRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.ACCOUNTS_LIST), payload: z.object({}).strict() })
  .strict();
const accountCreateRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.ACCOUNT_CREATE), payload: accountInputSchema })
  .strict();
const accountUpdateRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.ACCOUNT_UPDATE),
    payload: accountInputSchema.extend({ id: idSchema }).strict(),
  })
  .strict();
const accountArchiveRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.ACCOUNT_ARCHIVE),
    payload: z.object({ id: idSchema }).strict(),
  })
  .strict();
const paymentsListRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.PAYMENTS_LIST),
    payload: z.object({ bookingId: idSchema.optional() }).strict(),
  })
  .strict();
const paymentReceiptRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.PAYMENT_RECEIPT),
    payload: paymentDraftSchema
      .extend({ bookingId: idSchema, confirmOverpayment: z.boolean().optional() })
      .strict(),
  })
  .strict();
const paymentRefundPayloadSchema = paymentDraftSchema
  .extend({
    bookingId: idSchema,
    additionalSettlement: z.boolean().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.additionalSettlement === true && !input.reason?.trim()) {
      context.addIssue({
        code: "custom",
        message: "A reason is required for an additional settlement.",
        path: ["reason"],
      });
    }
  });
const paymentRefundRequestSchema = z
  .object({ channel: z.literal(IPC_CHANNELS.PAYMENT_REFUND), payload: paymentRefundPayloadSchema })
  .strict();
const paymentCorrectionPayloadSchema = paymentDraftSchema
  .extend({
    bookingId: idSchema,
    originalPaymentId: idSchema,
    direction: paymentDirectionSchema,
    reason: z.string().trim().min(1).max(500),
    confirmOverpayment: z.boolean().optional(),
    additionalSettlement: z.boolean().optional(),
  })
  .strict();
const paymentCorrectionRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.PAYMENT_CORRECTION),
    payload: paymentCorrectionPayloadSchema,
  })
  .strict();
const paymentReverseRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.PAYMENT_REVERSE),
    payload: z
      .object({
        paymentId: idSchema,
        paidAt: dateTimeSchema,
        reason: z.string().trim().min(1).max(500),
        confirmOverpayment: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();
const compensationMonthlyRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.COMPENSATION_MONTHLY),
    payload: z.object({ month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/) }).strict(),
  })
  .strict();
const expenseScopeSchema=z.enum(["unit","shared"]); const purchaseTypeSchema=z.enum(["cash","credit"]);
const expenseInputSchema=z.object({date:dateSchema,amount:positiveWholeUgxSchema,categoryId:z.string().min(1),scope:expenseScopeSchema,unitId:idSchema.nullable().optional(),supplierId:idSchema.nullable().optional(),accountId:idSchema.nullable().optional(),purchaseType:purchaseTypeSchema,dueDate:dateSchema.nullable().optional(),reference:z.string().max(500).nullable().optional(),notes:z.string().max(2000).nullable().optional()}).strict();
const supplierInputSchema=z.object({name:z.string().trim().min(1).max(160),phone:z.string().max(80).nullable().optional(),email:z.string().email().max(254).nullable().optional(),notes:z.string().max(2000).nullable().optional()}).strict();
const recurringInputSchema=z.object({categoryId:z.string().min(1),scope:expenseScopeSchema,unitId:idSchema.nullable().optional(),supplierId:idSchema.nullable().optional(),expectedAmount:wholeUgxSchema.nonnegative().nullable().optional(),cadence:z.enum(["monthly","quarterly","annually"]),nextReviewMonth:z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),notes:z.string().max(2000).nullable().optional()}).strict();
const expenseRequests=[
 z.object({channel:z.literal(IPC_CHANNELS.EXPENSES_LIST),payload:z.object({}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.EXPENSE_CREATE),payload:expenseInputSchema}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.SUPPLIERS_LIST),payload:z.object({}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.SUPPLIER_CREATE),payload:supplierInputSchema}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.SUPPLIER_PAYMENT),payload:z.object({expenseId:idSchema,amount:positiveWholeUgxSchema,paidAt:dateSchema,accountId:idSchema,method:paymentMethodSchema,reference:z.string().max(500).nullable().optional(),notes:z.string().max(2000).nullable().optional()}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.RECURRING_EXPENSES_LIST),payload:z.object({month:z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/)}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.RECURRING_EXPENSE_CREATE),payload:recurringInputSchema}).strict(),
] as const;
const monthSchema=z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const balanceCategorySchema=z.enum(["cash_on_hand","current_bank","mobile_money","long_term_deposit","customer_receivable","other_receivable","supplier_payable","staff_payable","referral_payable","tax_payable","pension_payable","owner_capital","owner_drawings"]);
const financeRequests=[
 z.object({channel:z.literal(IPC_CHANNELS.FINANCE_OVERVIEW),payload:z.object({month:monthSchema}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.BALANCE_SAVE),payload:z.object({month:monthSchema,category:balanceCategorySchema,amount:wholeUgxSchema.nonnegative(),accountId:idSchema.nullable().optional(),unitId:idSchema.nullable().optional(),notes:z.string().max(2000).nullable().optional()}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.INVENTORY_SAVE),payload:z.object({month:monthSchema,unitId:idSchema.nullable().optional(),value:wholeUgxSchema.nonnegative(),notes:z.string().max(2000).nullable().optional()}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.ASSET_CREATE),payload:z.object({category:z.enum(["furniture","machinery","equipment","vehicles","land","buildings"]),description:z.string().trim().min(1).max(300),purchaseDate:dateSchema,purchaseAmount:wholeUgxSchema.nonnegative(),unitId:idSchema.nullable().optional(),supplierId:idSchema.nullable().optional(),paymentMethod:z.string().max(100).nullable().optional(),usefulLifeMonths:z.number().int().positive().nullable().optional()}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.LOAN_CREATE),payload:z.object({lender:z.string().trim().min(1).max(300),kind:z.enum(["bank","non_bank","interest_free"]),classification:z.enum(["current","non_current"]),principal:wholeUgxSchema.nonnegative(),outstandingBalance:wholeUgxSchema.nonnegative(),interestRateBasisPoints:z.number().int().nonnegative().optional(),startDate:dateSchema,dueDate:dateSchema.nullable().optional(),notes:z.string().max(2000).nullable().optional()}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.PERIOD_CLOSE),payload:z.object({month:monthSchema}).strict()}).strict(),
 z.object({channel:z.literal(IPC_CHANNELS.PERIOD_REOPEN),payload:z.object({month:monthSchema,reason:z.string().trim().min(1).max(500)}).strict()}).strict(),
] as const;

export const ipcRequestSchema = z.discriminatedUnion("channel", [
  appReadyRequestSchema,
  businessStatusRequestSchema,
  businessCreateRequestSchema,
  businessUnlockRequestSchema,
  businessLockRequestSchema,
  manageUnitsRequestSchema,
  setRateRequestSchema,
  customersListRequestSchema,
  customerCreateRequestSchema,
  customerUpdateRequestSchema,
  customerArchiveRequestSchema,
  bookingsListRequestSchema,
  bookingGetRequestSchema,
  bookingCreateRequestSchema,
  bookingUpdateRequestSchema,
  bookingTransitionRequestSchema,
  bookingArchiveRequestSchema,
  accountsListRequestSchema,
  accountCreateRequestSchema,
  accountUpdateRequestSchema,
  accountArchiveRequestSchema,
  paymentsListRequestSchema,
  paymentReceiptRequestSchema,
  paymentRefundRequestSchema,
  paymentCorrectionRequestSchema,
  paymentReverseRequestSchema,
  compensationMonthlyRequestSchema,
  ...expenseRequests,
  ...financeRequests,
]);

export const IPC_FAILURE_CODES = [
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
  "INVALID_RESPONSE",
  "WRONG_PASSWORD",
  "LOCKED",
  "NOT_FOUND",
  "ALREADY_EXISTS",
  "CONFLICT",
  "INVALID_TRANSITION",
  "OVER_REFUND",
  "OVERPAYMENT_CONFIRMATION_REQUIRED",
] as const;
export type IpcFailureCode = (typeof IPC_FAILURE_CODES)[number];

export const ipcFailureSchema = z
  .object({
    ok: z.literal(false),
    code: z.enum(IPC_FAILURE_CODES),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())),
  })
  .strict();

const unitSchema = z
  .object({ id: z.string(), name: z.string(), status: z.enum(["active", "inactive"]) })
  .strict();
const rateSettingSchema = z
  .object({
    id: z.string(),
    value: z.number(),
    effectiveFrom: z.string(),
    reason: z.string().nullable(),
  })
  .strict();
const staffRateSettingSchema = rateSettingSchema.extend({ role: roleSchema }).strict();
const businessSettingsSchema = z
  .object({
    businessId: z.string(),
    name: z.string(),
    currency: z.literal("UGX"),
    unitIds: z.array(z.string()),
    units: z.array(unitSchema),
    staffRates: z.record(roleSchema, z.number()),
    referralRate: z.number(),
    taxProvisionPerUnit: z.number().int().nonnegative(),
    closedMonths: z.array(z.string()),
    rateHistory: z
      .object({
        staff: z.array(staffRateSettingSchema),
        referral: z.array(rateSettingSchema),
        taxProvision: z.array(rateSettingSchema),
      })
      .strict(),
  })
  .strict();
const businessStatusSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("setup") }).strict(),
  z.object({ state: z.literal("locked") }).strict(),
  z.object({ state: z.literal("ready"), business: businessSettingsSchema }).strict(),
]);
const customerSchema = z
  .object({
    id: z.string(),
    businessId: z.string(),
    name: z.string(),
    phone: z.string(),
    email: z.string().nullable(),
    notes: z.string().nullable(),
    archived: z.boolean(),
  })
  .strict();
const bookingSchema = z
  .object({
    id: z.string(),
    businessId: z.string(),
    unitId: z.string(),
    unitName: z.string(),
    customerId: z.string(),
    customerName: z.string(),
    customerPhone: z.string(),
    customerEmail: z.string().nullable(),
    referrerId: z.string().nullable(),
    referrerName: z.string().nullable(),
    checkIn: dateSchema,
    checkOut: dateSchema,
    checkInTime: timeSchema,
    checkOutTime: timeSchema,
    nights: z.number().int().positive(),
    nightlyRate: wholeUgxSchema.nonnegative(),
    adjustment: wholeUgxSchema,
    total: wholeUgxSchema.nonnegative(),
    status: bookingStatusSchema,
    paymentState: paymentStateSchema,
    received: wholeUgxSchema.nonnegative(),
    refunded: wholeUgxSchema.nonnegative(),
    netReceived: wholeUgxSchema,
    due: wholeUgxSchema.nonnegative(),
    balance: wholeUgxSchema.nonnegative(),
    notes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
const paymentAccountSchema = z
  .object({
    id: z.string(),
    businessId: z.string(),
    name: z.string(),
    type: paymentAccountTypeSchema,
    currency: z.literal("UGX"),
    archived: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
const paymentMovementSchema = z
  .object({
    id: z.string(),
    businessId: z.string(),
    bookingId: z.string(),
    customerName: z.string(),
    bookingTotal: wholeUgxSchema.nonnegative(),
    accountId: z.string(),
    accountName: z.string(),
    recordType: paymentRecordTypeSchema,
    direction: paymentDirectionSchema,
    amount: positiveWholeUgxSchema,
    paidAt: dateTimeSchema,
    method: paymentMethodSchema,
    reference: z.string().nullable(),
    note: z.string().nullable(),
    reversalOfId: z.string().nullable(),
    correctionOfId: z.string().nullable(),
    additionalSettlement: z.boolean(),
    reason: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
const staffStatementLineSchema = z.object({
  role: roleSchema,
  base: wholeUgxSchema.nonnegative(),
  rate: z.number().min(0).max(100),
  earned: wholeUgxSchema.nonnegative(),
  adjustment: wholeUgxSchema,
  paid: wholeUgxSchema.nonnegative(),
  due: wholeUgxSchema.nonnegative(),
}).strict();
const referralStatementLineSchema = z.object({
  bookingId: z.string(),
  customerName: z.string(),
  referrerName: z.string(),
  base: wholeUgxSchema.nonnegative(),
  rate: z.number().min(0).max(100),
  earned: wholeUgxSchema.nonnegative(),
  adjustment: wholeUgxSchema,
  paid: wholeUgxSchema.nonnegative(),
  due: wholeUgxSchema.nonnegative(),
}).strict();
const compensationTraceSchema = z.object({
  bookingId: z.string(),
  customerName: z.string(),
  unitName: z.string(),
  checkIn: dateSchema,
  checkOut: dateSchema,
  earnedRevenue: wholeUgxSchema.nonnegative(),
  eligibleBase: wholeUgxSchema.nonnegative(),
}).strict();
const monthlyCompensationReportSchema = z.object({
  month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
  ncbr: wholeUgxSchema.nonnegative(),
  staff: z.array(staffStatementLineSchema),
  referrals: z.array(referralStatementLineSchema),
  traces: z.array(compensationTraceSchema),
}).strict();
const expenseSchema=z.object({id:z.string(),date:dateSchema,amount:wholeUgxSchema.nonnegative(),categoryId:z.string(),scope:expenseScopeSchema,unitId:z.string().nullable(),supplierId:z.string().nullable(),supplierName:z.string().nullable(),accountId:z.string().nullable(),purchaseType:purchaseTypeSchema,paymentStatus:z.enum(["paid","partial","unpaid"]),dueDate:z.string().nullable(),reference:z.string().nullable(),notes:z.string().nullable(),paidAmount:wholeUgxSchema.nonnegative(),due:wholeUgxSchema.nonnegative()}).strict();
const supplierSchema=z.object({id:z.string(),name:z.string(),phone:z.string().nullable(),email:z.string().nullable(),balance:wholeUgxSchema.nonnegative()}).strict();
const recurringExpenseSchema=z.object({id:z.string(),categoryId:z.string(),scope:expenseScopeSchema,unitId:z.string().nullable(),supplierId:z.string().nullable(),expectedAmount:wholeUgxSchema.nonnegative().nullable(),cadence:z.enum(["monthly","quarterly","annually"]),nextReviewMonth:z.string(),notes:z.string().nullable()}).strict();
const positionSchema=z.object({month:monthSchema,cashAndCurrentAccounts:wholeUgxSchema.nonnegative(),longTermDeposits:wholeUgxSchema.nonnegative(),receivables:wholeUgxSchema.nonnegative(),inventory:wholeUgxSchema.nonnegative(),fixedAssets:wholeUgxSchema.nonnegative(),payables:wholeUgxSchema.nonnegative(),loans:wholeUgxSchema.nonnegative(),ownerEquity:wholeUgxSchema,totalAssets:wholeUgxSchema.nonnegative(),totalLiabilitiesAndEquity:wholeUgxSchema,difference:wholeUgxSchema,balanced:z.boolean()}).strict();
const assetSchema=z.object({id:z.string(),category:z.enum(["furniture","machinery","equipment","vehicles","land","buildings"]),description:z.string(),purchaseDate:dateSchema,purchaseAmount:wholeUgxSchema.nonnegative(),unitId:z.string().nullable(),supplierId:z.string().nullable(),paymentMethod:z.string().nullable(),usefulLifeMonths:z.number().int().positive().nullable(),status:z.enum(["active","disposed"])}).strict();
const loanSchema=z.object({id:z.string(),lender:z.string(),kind:z.enum(["bank","non_bank","interest_free"]),classification:z.enum(["current","non_current"]),principal:wholeUgxSchema.nonnegative(),outstandingBalance:wholeUgxSchema.nonnegative(),interestRateBasisPoints:z.number().int().nonnegative(),startDate:dateSchema,dueDate:dateSchema.nullable(),notes:z.string().nullable()}).strict();
const periodSchema=z.object({month:monthSchema,status:z.enum(["open","closed","reopened"]),reason:z.string().nullable()}).strict();

function responseSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data }).strict(),
    ipcFailureSchema,
  ]);
}

const responseSchemas = {
  [IPC_CHANNELS.APP_READY]: responseSchema(z.object({ ready: z.literal(true) }).strict()),
  [IPC_CHANNELS.BUSINESS_STATUS]: responseSchema(businessStatusSchema),
  [IPC_CHANNELS.BUSINESS_CREATE]: responseSchema(businessSettingsSchema),
  [IPC_CHANNELS.BUSINESS_UNLOCK]: responseSchema(businessSettingsSchema),
  [IPC_CHANNELS.BUSINESS_LOCK]: responseSchema(z.object({ state: z.literal("locked") }).strict()),
  [IPC_CHANNELS.BUSINESS_MANAGE_UNITS]: responseSchema(businessSettingsSchema),
  [IPC_CHANNELS.BUSINESS_SET_RATE]: responseSchema(businessSettingsSchema),
  [IPC_CHANNELS.CUSTOMERS_LIST]: responseSchema(z.array(customerSchema)),
  [IPC_CHANNELS.CUSTOMER_CREATE]: responseSchema(customerSchema),
  [IPC_CHANNELS.CUSTOMER_UPDATE]: responseSchema(customerSchema),
  [IPC_CHANNELS.CUSTOMER_ARCHIVE]: responseSchema(z.object({ archived: z.literal(true) }).strict()),
  [IPC_CHANNELS.BOOKINGS_LIST]: responseSchema(z.array(bookingSchema)),
  [IPC_CHANNELS.BOOKING_GET]: responseSchema(bookingSchema),
  [IPC_CHANNELS.BOOKING_CREATE]: responseSchema(bookingSchema),
  [IPC_CHANNELS.BOOKING_UPDATE]: responseSchema(bookingSchema),
  [IPC_CHANNELS.BOOKING_TRANSITION]: responseSchema(bookingSchema),
  [IPC_CHANNELS.BOOKING_ARCHIVE]: responseSchema(z.object({ archived: z.literal(true) }).strict()),
  [IPC_CHANNELS.ACCOUNTS_LIST]: responseSchema(z.array(paymentAccountSchema)),
  [IPC_CHANNELS.ACCOUNT_CREATE]: responseSchema(paymentAccountSchema),
  [IPC_CHANNELS.ACCOUNT_UPDATE]: responseSchema(paymentAccountSchema),
  [IPC_CHANNELS.ACCOUNT_ARCHIVE]: responseSchema(z.object({ archived: z.literal(true) }).strict()),
  [IPC_CHANNELS.PAYMENTS_LIST]: responseSchema(z.array(paymentMovementSchema)),
  [IPC_CHANNELS.PAYMENT_RECEIPT]: responseSchema(paymentMovementSchema),
  [IPC_CHANNELS.PAYMENT_REFUND]: responseSchema(paymentMovementSchema),
  [IPC_CHANNELS.PAYMENT_CORRECTION]: responseSchema(paymentMovementSchema),
  [IPC_CHANNELS.PAYMENT_REVERSE]: responseSchema(paymentMovementSchema),
  [IPC_CHANNELS.COMPENSATION_MONTHLY]: responseSchema(monthlyCompensationReportSchema),
  [IPC_CHANNELS.EXPENSES_LIST]: responseSchema(z.array(expenseSchema)), [IPC_CHANNELS.EXPENSE_CREATE]: responseSchema(expenseSchema),
  [IPC_CHANNELS.SUPPLIERS_LIST]: responseSchema(z.array(supplierSchema)), [IPC_CHANNELS.SUPPLIER_CREATE]: responseSchema(supplierSchema), [IPC_CHANNELS.SUPPLIER_PAYMENT]: responseSchema(expenseSchema),
  [IPC_CHANNELS.RECURRING_EXPENSES_LIST]: responseSchema(z.array(recurringExpenseSchema)), [IPC_CHANNELS.RECURRING_EXPENSE_CREATE]: responseSchema(recurringExpenseSchema),
  [IPC_CHANNELS.FINANCE_OVERVIEW]: responseSchema(z.object({position:positionSchema,assets:z.array(assetSchema),loans:z.array(loanSchema),period:periodSchema}).strict()),
  [IPC_CHANNELS.BALANCE_SAVE]:responseSchema(positionSchema),[IPC_CHANNELS.INVENTORY_SAVE]:responseSchema(positionSchema),
  [IPC_CHANNELS.ASSET_CREATE]:responseSchema(assetSchema),[IPC_CHANNELS.LOAN_CREATE]:responseSchema(loanSchema),
  [IPC_CHANNELS.PERIOD_CLOSE]:responseSchema(periodSchema),[IPC_CHANNELS.PERIOD_REOPEN]:responseSchema(periodSchema),
} as const;

export type IpcRequest = z.infer<typeof ipcRequestSchema>;
export type IpcChannel = IpcRequest["channel"];
export type IpcPayload<C extends IpcChannel> = Extract<IpcRequest, { channel: C }>["payload"];

export interface IpcFailure {
  readonly ok: false;
  readonly code: IpcFailureCode;
  readonly message: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
}

interface IpcDataByChannel {
  [IPC_CHANNELS.APP_READY]: { readonly ready: true };
  [IPC_CHANNELS.BUSINESS_STATUS]:
    | { readonly state: "setup" }
    | { readonly state: "locked" }
    | { readonly state: "ready"; readonly business: BusinessSettings };
  [IPC_CHANNELS.BUSINESS_CREATE]: BusinessSettings;
  [IPC_CHANNELS.BUSINESS_UNLOCK]: BusinessSettings;
  [IPC_CHANNELS.BUSINESS_LOCK]: { readonly state: "locked" };
  [IPC_CHANNELS.BUSINESS_MANAGE_UNITS]: BusinessSettings;
  [IPC_CHANNELS.BUSINESS_SET_RATE]: BusinessSettings;
  [IPC_CHANNELS.CUSTOMERS_LIST]: Customer[];
  [IPC_CHANNELS.CUSTOMER_CREATE]: Customer;
  [IPC_CHANNELS.CUSTOMER_UPDATE]: Customer;
  [IPC_CHANNELS.CUSTOMER_ARCHIVE]: { readonly archived: true };
  [IPC_CHANNELS.BOOKINGS_LIST]: Booking[];
  [IPC_CHANNELS.BOOKING_GET]: Booking;
  [IPC_CHANNELS.BOOKING_CREATE]: Booking;
  [IPC_CHANNELS.BOOKING_UPDATE]: Booking;
  [IPC_CHANNELS.BOOKING_TRANSITION]: Booking;
  [IPC_CHANNELS.BOOKING_ARCHIVE]: { readonly archived: true };
  [IPC_CHANNELS.ACCOUNTS_LIST]: PaymentAccount[];
  [IPC_CHANNELS.ACCOUNT_CREATE]: PaymentAccount;
  [IPC_CHANNELS.ACCOUNT_UPDATE]: PaymentAccount;
  [IPC_CHANNELS.ACCOUNT_ARCHIVE]: { readonly archived: true };
  [IPC_CHANNELS.PAYMENTS_LIST]: PaymentMovement[];
  [IPC_CHANNELS.PAYMENT_RECEIPT]: PaymentMovement;
  [IPC_CHANNELS.PAYMENT_REFUND]: PaymentMovement;
  [IPC_CHANNELS.PAYMENT_CORRECTION]: PaymentMovement;
  [IPC_CHANNELS.PAYMENT_REVERSE]: PaymentMovement;
  [IPC_CHANNELS.COMPENSATION_MONTHLY]: MonthlyCompensationReport;
  [IPC_CHANNELS.EXPENSES_LIST]: ExpenseRecord[]; [IPC_CHANNELS.EXPENSE_CREATE]: ExpenseRecord;
  [IPC_CHANNELS.SUPPLIERS_LIST]: Supplier[]; [IPC_CHANNELS.SUPPLIER_CREATE]: Supplier; [IPC_CHANNELS.SUPPLIER_PAYMENT]: ExpenseRecord;
  [IPC_CHANNELS.RECURRING_EXPENSES_LIST]: RecurringExpenseTemplate[]; [IPC_CHANNELS.RECURRING_EXPENSE_CREATE]: RecurringExpenseTemplate;
  [IPC_CHANNELS.FINANCE_OVERVIEW]: {position:FinancialPosition;assets:AssetRecord[];loans:LoanRecord[];period:PeriodClose};
  [IPC_CHANNELS.BALANCE_SAVE]:FinancialPosition;[IPC_CHANNELS.INVENTORY_SAVE]:FinancialPosition;
  [IPC_CHANNELS.ASSET_CREATE]:AssetRecord;[IPC_CHANNELS.LOAN_CREATE]:LoanRecord;
  [IPC_CHANNELS.PERIOD_CLOSE]:PeriodClose;[IPC_CHANNELS.PERIOD_REOPEN]:PeriodClose;
}

export type IpcData<C extends IpcChannel> = IpcDataByChannel[C];
export type IpcResult<C extends IpcChannel> =
  | { readonly ok: true; readonly data: IpcData<C> }
  | IpcFailure;

export interface StayBooksApi {
  invoke<C extends IpcChannel>(channel: C, payload: IpcPayload<C>): Promise<IpcResult<C>>;
}

export function validationFailure(error: z.ZodError): IpcFailure {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "request";
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return {
    ok: false,
    code: "VALIDATION_ERROR",
    message: "The request payload is invalid.",
    fieldErrors,
  };
}

export function publicFailure(
  code: IpcFailureCode,
  message?: string,
  fieldErrors: Readonly<Record<string, readonly string[]>> = {},
): IpcFailure {
  return {
    ok: false,
    code,
    message: message ?? "The request could not be completed.",
    fieldErrors,
  };
}

export function internalFailure(
  code: "INTERNAL_ERROR" | "INVALID_RESPONSE" = "INTERNAL_ERROR",
): IpcFailure {
  return publicFailure(
    code,
    code === "INVALID_RESPONSE"
      ? "The application returned an invalid response."
      : "The request could not be completed.",
  );
}

export function isValidIpcResponse<C extends IpcChannel>(
  channel: C,
  value: unknown,
): value is IpcResult<C> {
  return responseSchemas[channel].safeParse(value).success;
}

export type SetRatePayload = IpcPayload<typeof IPC_CHANNELS.BUSINESS_SET_RATE>;
export type StaffRole = RoleKey;
