import {
  IPC_CHANNELS,
  internalFailure,
  ipcRequestSchema,
  isValidIpcResponse,
  validationFailure,
  type IpcChannel,
  type IpcData,
  type IpcPayload,
  type IpcResult,
} from "../../shared/ipc";

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
};

const registeredChannels = [IPC_CHANNELS.APP_READY] as const;

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
      } catch {
        return internalFailure();
      }
    });
  }
}
