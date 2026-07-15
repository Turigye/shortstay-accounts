// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/renderer/App";
import { GUIDANCE_STORAGE_KEY } from "../../src/renderer/guidance/types";

vi.mock("../../src/renderer/screens/TodayScreen", () => ({
  TodayScreen: () => <h1>Today</h1>,
}));

vi.mock("../../src/renderer/screens/ReportsScreen", () => ({
  ReportsScreen: () => <><h1>Reports</h1><div data-tour="report-period" /><div data-tour="report-tabs" /></>,
}));

const business = {
  id: "business-1",
  businessId: "business-1",
  name: "Demo apartments",
  currency: "UGX",
  unitIds: [],
  units: [],
  staffRates: { operations: 5, salesMarketing: 5, finance: 10, itLegal: 2, security: 5, ceo: 10 },
  referralRate: 10,
  taxProvisionPerUnit: 0,
  closedMonths: [],
  rateHistory: { staff: [], referral: [], taxProvision: [] },
};

beforeEach(() => {
  localStorage.setItem(GUIDANCE_STORAGE_KEY, JSON.stringify({
    version: 1,
    welcomeDismissed: true,
    completedTourIds: [],
    completedChapterIds: [],
  }));
  Object.defineProperty(window, "stayBooks", {
    configurable: true,
    value: { invoke: vi.fn().mockResolvedValue({ ok: true, data: { state: "ready", business } }) },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("App Help navigation", () => {
  it("returns to the screen that was active before Help opened", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Help" }));
    await user.click(screen.getByRole("button", { name: "Back to workspace" }));

    expect(await screen.findByRole("heading", { name: "Today" })).toBeTruthy();
  });

  it("closes Help and immediately shows Reports when Reports is selected from the shell", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Help" }));
    expect(screen.getByRole("heading", { name: "Help Center" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Reports" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Reports" })).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "Help Center" })).toBeNull();
  });

  it("opens Help from the first-unlock guide action with focus inside Help", async () => {
    const user = userEvent.setup();
    localStorage.removeItem(GUIDANCE_STORAGE_KEY);
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Open guide" }));

    expect(await screen.findByRole("heading", { name: "Help Center" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search guide" })));
  });

  it("reveals the relevant Settings panel when a tour enters a Settings step", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Help" }));
    await user.click(screen.getByRole("button", { name: "Start tour: reports" }));
    await screen.findByRole("heading", { name: "Reports" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Rental tax" })).toBeTruthy();
    expect(document.querySelector('[data-tour="tax-guidance"]')?.textContent).toContain("Annual gross rental basis");
  });
});
