// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpCenterScreen } from "../../src/renderer/screens/HelpCenterScreen";
import { TourProvider, useTour } from "../../src/renderer/guidance/TourProvider";
import type { GuideChapterId } from "../../src/renderer/guidance/types";

function TourState() {
  const { activeTour } = useTour();
  return <output data-testid="active-tour">{activeTour?.id ?? ""}</output>;
}

function renderHelp() {
  const onClose = vi.fn();
  const onNavigate = vi.fn();
  render(
    <TourProvider navigate={onNavigate}>
      <HelpCenterScreen onClose={onClose} onNavigate={onNavigate} />
      <TourState />
    </TourProvider>,
  );
  return { onClose, onNavigate };
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("HelpCenterScreen", () => {
  it("searches chapters, checklists, and glossary entries together", async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.type(screen.getByRole("searchbox", { name: "Search guide" }), "partial payment");

    expect(screen.getByText("Money In and Money Out")).toBeTruthy();
    expect(screen.getByText("Chapter")).toBeTruthy();
  });

  it("starts the matching tour from each of the seven learning rows", async () => {
    const user = userEvent.setup();
    renderHelp();

    const chapters: GuideChapterId[] = ["orientation", "bookings", "money", "staff", "month-end", "reports", "administration"];
    for (const chapter of chapters) {
      await user.click(screen.getByRole("button", { name: `Start tour: ${chapter}` }));
      expect(screen.getByTestId("active-tour").textContent).toBe(chapter);
    }
  });

  it("navigates to a chapter screen and closes Help", async () => {
    const user = userEvent.setup();
    const { onClose, onNavigate } = renderHelp();

    await user.click(screen.getByRole("button", { name: "Go to screen: Booking Lifecycle" }));

    expect(onNavigate).toHaveBeenCalledWith("bookings");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("updates a chapter completion marker", async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.click(screen.getByRole("button", { name: "Mark Booking Lifecycle complete" }));

    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("makes checklist and glossary tabs reachable from the keyboard", async () => {
    const user = userEvent.setup();
    renderHelp();

    screen.getByRole("tab", { name: "Learn" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Checklists" }).getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Glossary" }).getAttribute("aria-selected")).toBe("true");
  });

  it("includes troubleshooting and professional advice boundaries", () => {
    renderHelp();

    expect(screen.getByRole("heading", { name: "Troubleshooting" })).toBeTruthy();
    expect(screen.getByText(/incorrect balances/i)).toBeTruthy();
    expect(screen.getByText(/wrong payments/i)).toBeTruthy();
    expect(screen.getByText(/closed periods/i)).toBeTruthy();
    expect(screen.getByText(/missed workflow steps/i)).toBeTruthy();
    expect(screen.getByText(/backup recovery/i)).toBeTruthy();
    expect(screen.getByText(/accountant or URA/i)).toBeTruthy();
  });
});
