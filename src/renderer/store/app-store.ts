import { create } from "zustand";

import type { BusinessSettings } from "../../domain/types";
import type { AuthenticatedUser } from "../../domain/users";
import {
  IPC_CHANNELS,
  type IpcFailure,
  type IpcPayload,
  type SetRatePayload,
} from "../../shared/ipc";

type AppPhase =
  | "booting"
  | "setup"
  | "databaseLocked"
  | "profileLocked"
  | "ready";
type CreatePayload = IpcPayload<typeof IPC_CHANNELS.BUSINESS_CREATE>;
type ManageUnitsPayload = IpcPayload<typeof IPC_CHANNELS.BUSINESS_MANAGE_UNITS>;

interface AppState {
  phase: AppPhase;
  business: BusinessSettings | null;
  user: AuthenticatedUser | null;
  error: string | null;
  busy: boolean;
  hydrate(): Promise<void>;
  createBusiness(payload: CreatePayload): Promise<void>;
  unlock(password: string): Promise<void>;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  lock(): Promise<void>;
  manageUnits(payload: ManageUnitsPayload): Promise<void>;
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
  user: null,
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
      business:
        result.data.state === "ready" || result.data.state === "profileLocked"
          ? result.data.business
          : null,
      user: result.data.state === "ready" ? result.data.user : null,
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
    set({
      busy: false,
      phase: "ready",
      business: result.data.business,
      user: result.data.user,
    });
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
    set({
      busy: false,
      phase: "ready",
      business: result.data.business,
      user: result.data.user,
    });
  },

  async login(username, password) {
    set({ busy: true, error: null });
    const request = window.stayBooks.invoke(IPC_CHANNELS.PROFILE_LOGIN, {
      username,
      password,
    });
    password = "";
    const result = await request;
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({
      busy: false,
      phase: "ready",
      business: result.data.business,
      user: result.data.user,
    });
  },

  async logout() {
    set({ busy: true, error: null });
    const result = await window.stayBooks.invoke(IPC_CHANNELS.PROFILE_LOGOUT, {});
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({ busy: false, phase: "profileLocked", user: null });
  },

  async lock() {
    set({ busy: true, error: null });
    const result = await window.stayBooks.invoke(IPC_CHANNELS.BUSINESS_LOCK, {});
    if (!result.ok) {
      set({ busy: false, error: failureMessage(result) });
      return;
    }
    set({ busy: false, phase: "databaseLocked", business: null, user: null });
  },

  async manageUnits(payload) {
    set({ busy: true, error: null });
    const result = await window.stayBooks.invoke(
      IPC_CHANNELS.BUSINESS_MANAGE_UNITS,
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
