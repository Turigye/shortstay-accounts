import { z } from "zod";

export const IPC_CHANNELS = {
  APP_READY: "app:ready",
} as const;

const appReadyRequestSchema = z
  .object({
    channel: z.literal(IPC_CHANNELS.APP_READY),
    payload: z.object({}).strict(),
  })
  .strict();

export const ipcRequestSchema = z.discriminatedUnion("channel", [
  appReadyRequestSchema,
]);

export const ipcFailureSchema = z
  .object({
    ok: z.literal(false),
    code: z.enum([
      "VALIDATION_ERROR",
      "INTERNAL_ERROR",
      "INVALID_RESPONSE",
    ]),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())),
  })
  .strict();

const appReadySuccessSchema = z
  .object({
    ok: z.literal(true),
    data: z.object({ ready: z.literal(true) }).strict(),
  })
  .strict();

const appReadyResponseSchema = z.discriminatedUnion("ok", [
  appReadySuccessSchema,
  ipcFailureSchema,
]);

export type IpcRequest = z.infer<typeof ipcRequestSchema>;
export type IpcChannel = IpcRequest["channel"];
export type IpcPayload<C extends IpcChannel> = Extract<
  IpcRequest,
  { channel: C }
>["payload"];

export interface IpcFailure {
  readonly ok: false;
  readonly code: "VALIDATION_ERROR" | "INTERNAL_ERROR" | "INVALID_RESPONSE";
  readonly message: string;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
}

interface IpcDataByChannel {
  [IPC_CHANNELS.APP_READY]: { readonly ready: true };
}

export type IpcData<C extends IpcChannel> = IpcDataByChannel[C];
export type IpcResult<C extends IpcChannel> =
  | { readonly ok: true; readonly data: IpcData<C> }
  | IpcFailure;

export interface StayBooksApi {
  invoke<C extends IpcChannel>(
    channel: C,
    payload: IpcPayload<C>,
  ): Promise<IpcResult<C>>;
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

export function internalFailure(
  code: "INTERNAL_ERROR" | "INVALID_RESPONSE" = "INTERNAL_ERROR",
): IpcFailure {
  return {
    ok: false,
    code,
    message:
      code === "INVALID_RESPONSE"
        ? "The application returned an invalid response."
        : "The request could not be completed.",
    fieldErrors: {},
  };
}

export function isValidIpcResponse<C extends IpcChannel>(
  channel: C,
  value: unknown,
): value is IpcResult<C> {
  switch (channel) {
    case IPC_CHANNELS.APP_READY:
      return appReadyResponseSchema.safeParse(value).success;
  }
}
