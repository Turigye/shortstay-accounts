import { z } from "zod";

import type { Booking, Customer } from "../domain/bookings";
import type { BusinessSettings, RoleKey } from "../domain/types";

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
const bookingInputSchema = z
  .object({
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
  })
  .strict();
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
    payload: bookingInputSchema.extend({ id: z.string().min(1) }).strict(),
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
    paymentState: z.enum(["unpaid", "partiallyPaid", "fullyPaid", "overpaid"]),
    received: wholeUgxSchema,
    balance: wholeUgxSchema,
    notes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

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
