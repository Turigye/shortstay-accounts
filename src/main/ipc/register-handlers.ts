import {
  BusinessRepositoryError,
} from "../db/repositories/business-repository";
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
  [IPC_CHANNELS.BUSINESS_LOCK]: () => ({ state: "locked" }),
  [IPC_CHANNELS.BUSINESS_MANAGE_UNITS]: () => {
    throw new Error("Business session is unavailable");
  },
  [IPC_CHANNELS.BUSINESS_SET_RATE]: () => {
    throw new Error("Business session is unavailable");
  },
};

const registeredChannels = [
  IPC_CHANNELS.APP_READY,
  IPC_CHANNELS.BUSINESS_STATUS,
  IPC_CHANNELS.BUSINESS_CREATE,
  IPC_CHANNELS.BUSINESS_UNLOCK,
  IPC_CHANNELS.BUSINESS_LOCK,
  IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
  IPC_CHANNELS.BUSINESS_SET_RATE,
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
      return { state: "locked" };
    },
    [IPC_CHANNELS.BUSINESS_MANAGE_UNITS]: (payload) => session.manageUnits(payload),
    [IPC_CHANNELS.BUSINESS_SET_RATE]: (payload) => session.setRate(payload),
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
        return internalFailure();
      }
    });
  }
}
