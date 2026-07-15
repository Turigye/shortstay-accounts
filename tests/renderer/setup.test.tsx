// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsScreen } from "../../src/renderer/screens/SettingsScreen";
import { SetupScreen } from "../../src/renderer/screens/SetupScreen";
import type { BusinessSettings } from "../../src/domain/types";

const business: BusinessSettings = {
  businessId: "business-1",
  name: "Client Business",
  currency: "UGX",
  unitIds: ["unit-1", "unit-2"],
  units: [
    { id: "unit-1", name: "Lake View", status: "active" },
    { id: "unit-2", name: "Garden Suite", status: "active" },
  ],
  staffRates: {
    operations: 5,
    salesMarketing: 5,
    finance: 10,
    itLegal: 2,
    security: 5,
    ceo: 10,
  },
  referralRate: 10,
  taxProvisionPerUnit: 600_000 as BusinessSettings["taxProvisionPerUnit"],
  closedMonths: [],
  rateHistory: { staff: [], referral: [], taxProvision: [] },
};

afterEach(cleanup);

describe("business setup", () => {
  it("shows the exact two-unit questionnaire and monthly UGX provision before creation", () => {
    render(<SetupScreen onCreate={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Set up your business" })).toBeTruthy();
    expect(screen.getAllByLabelText(/unit \d name/i)).toHaveLength(2);
    expect(screen.queryByLabelText(/unit 3/i)).toBeNull();
    expect(screen.getByText("UGX 115,800")).toBeTruthy();
    expect(screen.getByText("37% total staff allocation")).toBeTruthy();
    expect(screen.getByText("10% referral commission")).toBeTruthy();
    expect(screen.getByText("UGX 600,000 monthly rental basis per unit")).toBeTruthy();
  });

  it("submits from the keyboard and clears password fields before awaiting creation", async () => {
    let resolveCreate: (() => void) | undefined;
    const onCreate = vi.fn(
      () => new Promise<void>((resolve) => { resolveCreate = resolve; }),
    );
    render(<SetupScreen onCreate={onCreate} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Business name"), "Client Business");
    await user.clear(screen.getByLabelText("Unit 1 name"));
    await user.type(screen.getByLabelText("Unit 1 name"), "Lake View");
    await user.clear(screen.getByLabelText("Unit 2 name"));
    await user.type(screen.getByLabelText("Unit 2 name"), "Garden Suite");
    await user.type(screen.getByLabelText("Local password"), "long local password");
    await user.type(screen.getByLabelText("Confirm password"), "long local password");
    await user.click(screen.getByRole("checkbox", { name: /approved defaults/i }));
    await user.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledWith({
      name: "Client Business",
      unitNames: ["Lake View", "Garden Suite"],
      password: "long local password",
    });
    expect(screen.getByLabelText<HTMLInputElement>("Local password").value).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Confirm password").value).toBe("");

    resolveCreate?.();
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Create business" }).disabled).toBe(false));
  });

  it("preserves non-secret fields and reports password mismatch inline", async () => {
    const onCreate = vi.fn();
    render(<SetupScreen onCreate={onCreate} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Business name"), "Client Business");
    await user.type(screen.getByLabelText("Local password"), "long local password");
    await user.type(screen.getByLabelText("Confirm password"), "different password");
    await user.click(screen.getByRole("checkbox", { name: /approved defaults/i }));
    await user.click(screen.getByRole("button", { name: "Create business" }));

    expect(screen.getByText("Passwords must match.")).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>("Business name").value).toBe("Client Business");
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("settings", () => {
  it("shows three unique visible Backup navigation controls while Units is active", () => {
    const onLock = vi.fn();
    const onManageUnits = vi.fn();
    const onSetRate = vi.fn();
    const invoke = vi.fn();
    Object.defineProperty(window, "stayBooks", {
      configurable: true,
      value: { invoke },
    });
    render(<SettingsScreen business={business} onLock={onLock} onManageUnits={onManageUnits} onSetRate={onSetRate} />);

    expect(screen.getByRole("heading", { name: "Units" })).toBeTruthy();
    const tablist = screen.getByRole("tablist", { name: "Settings sections" });
    const backupTab = within(tablist).getByRole("tab", { name: "Backup" });
    const restoreShortcut = screen.getByRole("button", { name: "Open Backup section for Restore" });
    const exportShortcut = screen.getByRole("button", { name: "Open Backup section for Excel export" });

    for (const [target, control] of [
      ["backup", backupTab],
      ["restore", restoreShortcut],
      ["excel-export", exportShortcut],
    ] as const) {
      const matches = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(control);
      expect(control.hidden).toBe(false);
      expect(control.getAttribute("aria-hidden")).not.toBe("true");
      expect(getComputedStyle(control).display).not.toBe("none");
      expect(getComputedStyle(control).visibility).not.toBe("hidden");
    }

    expect(tablist.contains(restoreShortcut)).toBe(false);
    expect(tablist.contains(exportShortcut)).toBe(false);
    expect(restoreShortcut.title).toBe("Open Backup section for Restore");
    expect(exportShortcut.title).toBe("Open Backup section for Excel export");

    expect(onLock).not.toHaveBeenCalled();
    expect(onManageUnits).not.toHaveBeenCalled();
    expect(onSetRate).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["Open Backup section for Restore", "Restore"],
    ["Open Backup section for Excel export", "Export Excel"],
  ])("opens Backup from the %s shortcut without invoking %s", async (shortcutName, actionName) => {
    const onLock = vi.fn();
    const onManageUnits = vi.fn();
    const onSetRate = vi.fn();
    const invoke = vi.fn();
    Object.defineProperty(window, "stayBooks", {
      configurable: true,
      value: { invoke },
    });
    render(<SettingsScreen business={business} onLock={onLock} onManageUnits={onManageUnits} onSetRate={onSetRate} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: shortcutName }));

    expect(screen.getByRole("heading", { name: "Backup and export" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Units" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Backup" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: actionName })).toBeTruthy();

    expect(onLock).not.toHaveBeenCalled();
    expect(onManageUnits).not.toHaveBeenCalled();
    expect(onSetRate).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("exposes all specified settings tabs without later-task action placeholders", async () => {
    render(
      <SettingsScreen
        business={business}
        onLock={vi.fn()}
        onManageUnits={vi.fn()}
        onSetRate={vi.fn()}
      />,
    );

    const tabs = screen.getByRole("tablist", { name: "Settings sections" });
    for (const name of [
      "Units",
      "Compensation",
      "Referral",
      "Rental tax",
      "Categories",
      "Accounts",
      "Backup",
      "Security",
    ]) {
      expect(within(tabs).getByRole("tab", { name })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: /coming soon/i })).toBeNull();
  });

  it("requires a reason in the rate form when the effective date is historical", async () => {
    render(
      <SettingsScreen
        business={business}
        onLock={vi.fn()}
        onManageUnits={vi.fn()}
        onSetRate={vi.fn()}
        today="2026-07-14"
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText("Effective from"), {
      target: { value: "2026-06-01" },
    });

    expect(screen.getByLabelText<HTMLInputElement>("Reason for historical change").required).toBe(true);
    expect(screen.getByText(/required because this date is in a historical period/i)).toBeTruthy();
  });

  it("saves a rate on today's default effective date", async () => {
    const onSetRate = vi.fn();
    render(
      <SettingsScreen
        business={business}
        onLock={vi.fn()}
        onManageUnits={vi.fn()}
        onSetRate={onSetRate}
        today="2026-07-14"
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: "Referral" }));
    await user.clear(screen.getByLabelText("Rate"));
    await user.type(screen.getByLabelText("Rate"), "12");
    await user.click(screen.getByRole("button", { name: "Save rate" }));

    expect(onSetRate).toHaveBeenCalledWith({
      kind: "referral",
      value: 12,
      effectiveFrom: "2026-07-14",
    });
  });

  it("adds and archives units while preserving every existing unit", async () => {
    const onManageUnits = vi.fn();
    const { rerender } = render(
      <SettingsScreen
        business={business}
        onLock={vi.fn()}
        onManageUnits={onManageUnits}
        onSetRate={vi.fn()}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Add unit" }));
    await user.type(screen.getByLabelText("Unit 3 name"), "Pool House");
    await user.click(screen.getByRole("button", { name: "Save units" }));
    expect(onManageUnits).toHaveBeenLastCalledWith({
      units: [
        { id: "unit-1", name: "Lake View" },
        { id: "unit-2", name: "Garden Suite" },
        { name: "Pool House" },
      ],
    });

    const withThird = {
      ...business,
      unitIds: ["unit-1", "unit-2", "unit-3"],
      units: [
        ...business.units,
        { id: "unit-3", name: "Pool House", status: "active" as const },
      ],
    };
    rerender(
      <SettingsScreen
        business={withThird}
        onLock={vi.fn()}
        onManageUnits={onManageUnits}
        onSetRate={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Archive Pool House" }));
    await user.click(screen.getByRole("button", { name: "Save units" }));
    expect(onManageUnits).toHaveBeenLastCalledWith({
      units: [
        { id: "unit-1", name: "Lake View" },
        { id: "unit-2", name: "Garden Suite" },
      ],
    });
  });
});
