import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: { invoke: electron.invoke },
}));

import { registerIpcHandlers } from "../../src/main/ipc/register-handlers";
import { BusinessRepositoryError } from "../../src/main/db/repositories/business-repository";
import { createStayBooksApi } from "../../src/preload";
import {
  IPC_CHANNELS,
  ipcRequestSchema,
  type IpcFailure,
} from "../../src/shared/ipc";

interface RegisteredHandler {
  (event: unknown, payload: unknown): Promise<unknown> | unknown;
}

function captureHandlers(): Map<string, RegisteredHandler> {
  const handlers = new Map<string, RegisteredHandler>();
  registerIpcHandlers({
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
  });
  return handlers;
}

beforeEach(() => {
  electron.invoke.mockReset();
});

describe("IPC contract", () => {
  it("uses a discriminated allowlist and rejects unknown keys", () => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.APP_READY,
        payload: {},
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({ channel: "database:query", payload: {} })
        .success,
    ).toBe(false);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.APP_READY,
        payload: { injected: true },
      }).success,
    ).toBe(false);
  });

  it("registers only named channels", () => {
    const handlers = captureHandlers();

    expect([...handlers.keys()]).toEqual([
      IPC_CHANNELS.APP_READY,
      IPC_CHANNELS.BUSINESS_STATUS,
      IPC_CHANNELS.BUSINESS_CREATE,
      IPC_CHANNELS.BUSINESS_UNLOCK,
      IPC_CHANNELS.BUSINESS_LOCK,
      IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
      IPC_CHANNELS.BUSINESS_SET_RATE,
    ]);
    expect(handlers.has("database:query")).toBe(false);
  });

  it("returns structured field errors for invalid payloads", async () => {
    const handler = captureHandlers().get(IPC_CHANNELS.APP_READY);
    const result = (await handler?.(undefined, { injected: true })) as IpcFailure;

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "The request payload is invalid.",
      fieldErrors: {
        payload: [expect.stringContaining("injected")],
      },
    });
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("sanitizes handler exceptions without leaking stack traces", async () => {
    const secret = "sensitive-database-path";
    const handlers = new Map<string, RegisteredHandler>();
    registerIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        },
      },
      {
        [IPC_CHANNELS.APP_READY]: () => {
          throw new Error(secret);
        },
      },
    );

    const result = await handlers.get(IPC_CHANNELS.APP_READY)?.(undefined, {});
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      fieldErrors: {},
    });
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("stack");
  });

  it("keeps create and unlock passwords inside strict named payloads", () => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_CREATE,
        payload: {
          name: "Client Business",
          unitNames: ["Unit 1", "Unit 2"],
          password: "long local password",
        },
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_UNLOCK,
        payload: { password: "wrong", databaseKey: "must-not-pass" },
      }).success,
    ).toBe(false);
  });

  it("accepts arbitrary non-empty unit lists after setup", () => {
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
        payload: {
          units: [
            { id: "unit-1", name: "Lake View" },
            { id: "unit-2", name: "Garden Suite" },
            { name: "Pool House" },
          ],
        },
      }).success,
    ).toBe(true);
    expect(
      ipcRequestSchema.safeParse({
        channel: IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
        payload: { units: [] },
      }).success,
    ).toBe(false);
  });

  it("returns useful structured repository validation errors", async () => {
    const handlers = new Map<string, RegisteredHandler>();
    registerIpcHandlers(
      {
        handle(channel, handler) {
          handlers.set(channel, handler);
        },
      },
      {
        [IPC_CHANNELS.BUSINESS_SET_RATE]: () => {
          throw new BusinessRepositoryError(
            "VALIDATION_ERROR",
            "A reason is required for historical or closed-period changes.",
            {
              effectiveFrom: [
                "Enter a reason for this historical or closed period.",
              ],
            },
          );
        },
      },
    );

    expect(
      await handlers.get(IPC_CHANNELS.BUSINESS_SET_RATE)?.(undefined, {
        kind: "referral",
        value: 12,
        effectiveFrom: "2026-06-01",
      }),
    ).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "A reason is required for historical or closed-period changes.",
      fieldErrors: {
        effectiveFrom: ["Enter a reason for this historical or closed period."],
      },
    });
  });
});

describe("preload API", () => {
  it("exposes only a frozen typed invoke capability", () => {
    const api = createStayBooksApi(vi.fn());

    expect(Object.keys(api)).toEqual(["invoke"]);
    expect(Object.isFrozen(api)).toBe(true);
    expect(electron.exposeInMainWorld).toHaveBeenCalledWith(
      "stayBooks",
      expect.objectContaining({ invoke: expect.any(Function) }),
    );
  });

  it("rejects invalid renderer input before it reaches Electron", async () => {
    const invoke = vi.fn();
    const api = createStayBooksApi(invoke);

    const result = await api.invoke(
      IPC_CHANNELS.APP_READY,
      { injected: true } as never,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { payload: expect.any(Array) },
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("invokes a named channel and accepts only its validated response", async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      data: { ready: true },
    });
    const api = createStayBooksApi(invoke);

    await expect(api.invoke(IPC_CHANNELS.APP_READY, {})).resolves.toEqual({
      ok: true,
      data: { ready: true },
    });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_READY, {});

    invoke.mockResolvedValueOnce({ ok: true, data: { ready: true, extra: 1 } });
    await expect(api.invoke(IPC_CHANNELS.APP_READY, {})).resolves.toMatchObject({
      ok: false,
      code: "INVALID_RESPONSE",
    });
  });
});
