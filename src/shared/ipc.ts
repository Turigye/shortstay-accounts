import { z } from "zod";

import type { BusinessSettings, RoleKey } from "../domain/types";

export const IPC_CHANNELS = {
  APP_READY: "app:ready",
  BUSINESS_STATUS: "business:status",
  BUSINESS_CREATE: "business:create",
  BUSINESS_UNLOCK: "business:unlock",
  BUSINESS_LOCK: "business:lock",
  BUSINESS_RENAME_UNITS: "business:rename-units",
  BUSINESS_SET_RATE: "business:set-rate",
} as const;

const roleSchema = z.enum([
  "operations",
  "salesMarketing",
  "finance",
  "itLegal",
  "security",
  "ceo",
]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const passwordSchema = z.string().min(1).max(1024);
const unitNamesSchema = z.tuple([
  z.string().trim().min(1).max(120),
  z.string().trim().min(1).max(120),
]);

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
const renameUnitsRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BUSINESS_RENAME_UNITS),
    payload: z
      .object({
        units: z.tuple([
          z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(120) }).strict(),
          z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(120) }).strict(),
        ]),
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
const generalRateRequestSchema = z
  .object({
    kind: z.enum(["referral", "taxProvision"]),
    value: z.number().nonnegative(),
    effectiveFrom: dateSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
const setRateRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.BUSINESS_SET_RATE),
    payload: z.discriminatedUnion("kind", [staffRateRequestSchema, generalRateRequestSchema]),
  })
  .strict();

export const ipcRequestSchema = z.discriminatedUnion("channel", [
  appReadyRequestSchema,
  businessStatusRequestSchema,
  businessCreateRequestSchema,
  businessUnlockRequestSchema,
  businessLockRequestSchema,
  renameUnitsRequestSchema,
  setRateRequestSchema,
]);

export const IPC_FAILURE_CODES = [
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
  "INVALID_RESPONSE",
  "WRONG_PASSWORD",
  "LOCKED",
  "NOT_FOUND",
  "ALREADY_EXISTS",
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
  [IPC_CHANNELS.BUSINESS_RENAME_UNITS]: responseSchema(businessSettingsSchema),
  [IPC_CHANNELS.BUSINESS_SET_RATE]: responseSchema(businessSettingsSchema),
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
  [IPC_CHANNELS.BUSINESS_RENAME_UNITS]: BusinessSettings;
  [IPC_CHANNELS.BUSINESS_SET_RATE]: BusinessSettings;
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
  code: Exclude<IpcFailureCode, "VALIDATION_ERROR">,
  message?: string,
): IpcFailure {
  return {
    ok: false,
    code,
    message: message ?? "The request could not be completed.",
    fieldErrors: {},
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
