import { create } from "zustand";

import type { BusinessSettings } from "../../domain/types";
import {
  IPC_CHANNELS,
  type IpcFailure,
  type IpcPayload,
  type SetRatePayload,
} from "../../shared/ipc";

type AppPhase = "booting" | "setup" | "locked" | "ready";
type CreatePayload = IpcPayload<typeof IPC_CHANNELS.BUSINESS_CREATE>;
type RenameUnitsPayload = IpcPayload<typeof IPC_CHANNELS.BUSINESS_RENAME_UNITS>;

interface AppState {
  phase: AppPhase;
  business: BusinessSettings | null;
  error: string | null;
  busy: boolean;
  hydrate(): Promise<void>;
  createBusiness(payload: CreatePayload): Promise<void>;
  unlock(password: string): Promise<void>;
  lock(): Promise<void>;
  renameUnits(payload: RenameUnitsPayload): Promise<void>;
  setRate(payload: SetRatePayload): Promise<void>;
  clearError(): void;
}

function failureMessage(failure: IpcFailure): string {
  const firstFieldError = Object.values(failure.fieldErrors)[0]?.[0];
  return firstFieldError ?? failure.message;
}

export const useAppStore = create<AppState>((set, get) => ({
  phase: "booting",
  business: null,
  error: null,
  busy: false,

  async hydrate() {
    if (get().busy) return;
    set({ busy: true, error: null });
    const result = await window.stayBooks.invoke(IPC_CHANNELS.BUSINESS_STATUS, {});
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({
      busy: false,
      phase: result.data.state,
      business: result.data.state === "ready" ? result.data.business : null,
    });
  },

  async createBusiness(payload) {
    set({ busy: true, error: null });
    let password = payload.password;
    const request = window.stayBooks.invoke(IPC_CHANNELS.BUSINESS_CREATE, {
      name: payload.name,
      unitNames: payload.unitNames,
      password,
    });
    password = "";
    const result = await request;
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({ busy: false, phase: "ready", business: result.data });
  },

  async unlock(password) {
    set({ busy: true, error: null });
    const request = window.stayBooks.invoke(IPC_CHANNELS.BUSINESS_UNLOCK, { password });
    password = "";
    const result = await request;
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({ busy: false, phase: "ready", business: result.data });
  },

  async lock() {
    set({ busy: true, error: null });
    const result = await window.stayBooks.invoke(IPC_CHANNELS.BUSINESS_LOCK, {});
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({ busy: false, phase: "locked", business: null });
  },

  async renameUnits(payload) {
    set({ busy: true, error: null });
    const result = await window.stayBooks.invoke(
      IPC_CHANNELS.BUSINESS_RENAME_UNITS,
      payload,
    );
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({ busy: false, business: result.data });
  },

  async setRate(payload) {
    set({ busy: true, error: null });
    const result = await window.stayBooks.invoke(IPC_CHANNELS.BUSINESS_SET_RATE, payload);
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({ busy: false, business: result.data });
  },

  clearError() {
    set({ error: null });
  },
}));
