import { contextBridge, ipcRenderer } from "electron";

import {
  internalFailure,
  ipcRequestSchema,
  isValidIpcResponse,
  validationFailure,
  type IpcChannel,
  type IpcPayload,
  type IpcResult,
  type StayBooksApi,
} from "../shared/ipc";

type InvokeElectron = (channel: string, payload: unknown) => Promise<unknown>;

export function createStayBooksApi(invokeElectron: InvokeElectron): StayBooksApi {
  return Object.freeze({
    async invoke<C extends IpcChannel>(
      channel: C,
      payload: IpcPayload<C>,
    ): Promise<IpcResult<C>> {
      const request = ipcRequestSchema.safeParse({ channel, payload });
      if (!request.success) return validationFailure(request.error);

      try {
        const response = await invokeElectron(
          request.data.channel,
          request.data.payload,
        );
        return isValidIpcResponse(channel, response)
          ? response
          : internalFailure("INVALID_RESPONSE");
      } catch {
        return internalFailure();
      }
    },
  });
}

const stayBooks = createStayBooksApi((channel, payload) =>
  ipcRenderer.invoke(channel, payload),
);

contextBridge.exposeInMainWorld("stayBooks", stayBooks);

declare global {
  interface Window {
    readonly stayBooks: StayBooksApi;
  }
}
