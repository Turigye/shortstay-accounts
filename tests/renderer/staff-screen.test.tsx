// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffScreen } from "../../src/renderer/screens/StaffScreen";

afterEach(cleanup);

describe("staff compensation screen", () => {
  it("shows the six role statement, referral details, and calculation trace", async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        month: "2026-07",
        ncbr: 200_000,
        staff: [
          ["operations", 5, 10_000],
          ["salesMarketing", 5, 10_000],
          ["finance", 10, 20_000],
          ["itLegal", 2, 4_000],
          ["security", 5, 10_000],
          ["ceo", 10, 20_000],
        ].map(([role, rate, earned]) => ({
          role, base: 200_000, rate, earned, adjustment: 0, paid: 0, due: earned,
        })),
        referrals: [{
          bookingId: "booking-12345678",
          customerName: "Amina N.",
          referrerName: "Kato Travel",
          base: 200_000,
          rate: 10,
          earned: 20_000,
          adjustment: 0,
          paid: 0,
          due: 20_000,
        }],
        traces: [{
          bookingId: "booking-12345678",
          customerName: "Amina N.",
          unitName: "Lake View",
          checkIn: "2026-07-30",
          checkOut: "2026-08-03",
          earnedRevenue: 400_000,
          eligibleBase: 200_000,
        }],
      },
    });
    Object.defineProperty(window, "stayBooks", { configurable: true, value: { invoke } });
    render(<StaffScreen />);

    await waitFor(() => expect(screen.getByText("Operations Manager")).toBeTruthy());
    expect(screen.getByText("Sales and Marketing")).toBeTruthy();
    expect(screen.getByText("IT and Legal")).toBeTruthy();
    expect(screen.getAllByText("UGX 200,000").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Referrals" }));
    expect(screen.getByText("Kato Travel")).toBeTruthy();
    expect(screen.getAllByText(/Amina N\./).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByText("Calculation trace"));
    expect(screen.getByText("Lake View")).toBeTruthy();
    expect(screen.getByText("2026-07-30 to 2026-08-03")).toBeTruthy();
  });
});
