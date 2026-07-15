// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FirstUnlockWelcome } from "../../src/renderer/guidance/FirstUnlockWelcome";
import { GuidedTour } from "../../src/renderer/guidance/GuidedTour";
import { TourProvider, useTour } from "../../src/renderer/guidance/TourProvider";
import type { TourDefinition } from "../../src/renderer/guidance/types";

const { tour } = vi.hoisted(() => ({ tour: {
  id: "orientation",
  title: "Test tour",
  summary: "A test-only tour.",
  steps: [
    { id: "one", screen: "today", target: "one", title: "First step", body: "First guidance.", placement: "right" },
    { id: "two", screen: "today", target: "two", title: "Second step", body: "Second guidance.", placement: "right" },
  ],
} satisfies TourDefinition }));

vi.mock("../../src/renderer/guidance/guide-content", async (importOriginal) => ({
  ...(await importOriginal()),
  tourDefinitions: [tour],
}));

function TourControls(): ReactNode {
  const { startTour } = useTour();
  return <button onClick={(event) => startTour("orientation", event.currentTarget)} type="button">Begin tour</button>;
}

function WelcomeWithPersistentReturnTarget({ onOpenGuide }: { onOpenGuide: () => void }) {
  const [returnFocusTarget, setReturnFocusTarget] = useState<HTMLElement | null>(null);

  return (
    <>
      <button ref={setReturnFocusTarget} type="button">Persistent focus return</button>
      <FirstUnlockWelcome onOpenGuide={onOpenGuide} returnFocusTarget={returnFocusTarget} />
    </>
  );
}

function renderGuidance(
  onOpenGuide = vi.fn(),
  targets: "all" | "second" = "all",
  onTargetAction = vi.fn(),
  includeWelcome: false | true | "with-persistent-return-target" = false,
) {
  const navigate = vi.fn();
  render(
    <TourProvider navigate={navigate}>
      <TourControls />
      {targets === "all" ? <button data-tour="one" onClick={onTargetAction} type="button">First target</button> : null}
      <button data-tour="two" type="button">Second target</button>
      <GuidedTour />
      {includeWelcome === true ? <FirstUnlockWelcome onOpenGuide={onOpenGuide} /> : null}
      {includeWelcome === "with-persistent-return-target" ? <WelcomeWithPersistentReturnTarget onOpenGuide={onOpenGuide} /> : null}
    </TourProvider>,
  );
  return { navigate, onOpenGuide, onTargetAction };
}

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 100, y: 120, top: 120, right: 380, bottom: 200, left: 100, width: 280, height: 80,
    toJSON: () => ({}),
  });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
});

afterEach(() => {
  cleanup();
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GuidedTour", () => {
  it("names the dialog, announces progress, focuses its heading, and highlights the live target", async () => {
    const user = userEvent.setup();
    renderGuidance();

    await user.click(screen.getByRole("button", { name: "Begin tour" }));

    const dialog = await screen.findByRole("dialog", { name: "Test tour" });
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "First step" }));
    expect(dialog.querySelector<HTMLElement>(".tour-spotlight-focus")?.style.left).toBe("92px");
    expect(dialog.querySelector<HTMLElement>(".tour-spotlight-focus")?.style.top).toBe("112px");
    expect(dialog.querySelector<HTMLElement>(".tour-spotlight-focus")?.style.width).toBe("296px");
    expect(dialog.querySelector<HTMLElement>(".tour-spotlight-focus")?.style.height).toBe("96px");
  });

  it("moves between steps, completes, and restores focus to the opener", async () => {
    const user = userEvent.setup();
    renderGuidance();

    const opener = screen.getByRole("button", { name: "Begin tour" });
    await user.click(opener);
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Test tour" })).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("skips with Escape", async () => {
    const user = userEvent.setup();
    renderGuidance();

    await user.click(screen.getByRole("button", { name: "Begin tour" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Test tour" })).toBeNull();
  });

  it("blocks interaction with the highlighted control while the tour is active", async () => {
    const user = userEvent.setup();
    const onTargetAction = vi.fn();
    renderGuidance(vi.fn(), "all", onTargetAction);

    await user.click(screen.getByRole("button", { name: "Begin tour" }));
    await screen.findByRole("dialog", { name: "Test tour" });
    await user.click(screen.getByRole("button", { name: "First target" }));

    expect(onTargetAction).not.toHaveBeenCalled();
  });

  it("chooses the most spacious fitting placement when the requested side does not fit", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1_000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("tour-panel")) {
        return {
          x: 486, y: 68, top: 68, right: 846, bottom: 304, left: 486, width: 360, height: 236,
          toJSON: () => ({}),
        };
      }

      return {
        x: 300, y: 300, top: 300, right: 700, bottom: 350, left: 300, width: 400, height: 50,
        toJSON: () => ({}),
      };
    });
    const user = userEvent.setup();
    renderGuidance();

    await user.click(screen.getByRole("button", { name: "Begin tour" }));

    const panel = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(".tour-panel");
      expect(element).not.toBeNull();
      return element!;
    });
    expect(panel.dataset.placement).toBe("bottom");
    expect(Number.parseFloat(panel.style.top)).toBe(370);
  });

  it("advances when a target remains missing beyond the bounded discovery wait", async () => {
    vi.useFakeTimers();
    renderGuidance(vi.fn(), "second");

    act(() => {
      screen.getByRole("button", { name: "Begin tour" }).click();
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByRole("dialog", { name: "Test tour" })).toBeTruthy();
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
  });
});

describe("FirstUnlockWelcome", () => {
  it("starts Orientation and then exposes the tour", async () => {
    const user = userEvent.setup();
    const { navigate } = renderGuidance(vi.fn(), "all", vi.fn(), true);

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(navigate).toHaveBeenCalledWith("today");
    expect(await screen.findByRole("dialog", { name: "Test tour" })).toBeTruthy();
  });

  it("dismisses without starting when exploring independently", async () => {
    const user = userEvent.setup();
    const { navigate } = renderGuidance(vi.fn(), "all", vi.fn(), true);

    await user.click(screen.getByRole("button", { name: "Explore independently" }));

    expect(screen.queryByRole("dialog", { name: "Welcome to Short-Stay Accounts" })).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("dismisses before opening the guide", async () => {
    const user = userEvent.setup();
    const onOpenGuide = vi.fn();
    renderGuidance(onOpenGuide, "all", vi.fn(), true);

    await user.click(screen.getByRole("button", { name: "Open guide" }));

    expect(screen.queryByRole("dialog", { name: "Welcome to Short-Stay Accounts" })).toBeNull();
    expect(onOpenGuide).toHaveBeenCalledOnce();
  });

  it("traps focus in its controls and dismisses safely with Escape", async () => {
    const user = userEvent.setup();
    const { navigate } = renderGuidance(vi.fn(), "all", vi.fn(), true);

    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Welcome to Short-Stay Accounts" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Start" }));
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open guide" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Start" }));
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Start" }));

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Welcome to Short-Stay Accounts" })).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("blocks pointer access to app controls behind the full-screen backdrop", async () => {
    const user = userEvent.setup();
    const { navigate } = renderGuidance(vi.fn(), "all", vi.fn(), true);

    await user.click(screen.getByRole("button", { name: "Begin tour" }));

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Welcome to Short-Stay Accounts" })).toBeTruthy();
  });

  it("restores Orientation focus to the persistent welcome return target", async () => {
    const user = userEvent.setup();
    renderGuidance(vi.fn(), "all", vi.fn(), "with-persistent-return-target");

    const returnFocusTarget = screen.getByRole("button", { name: "Persistent focus return" });
    await user.click(screen.getByRole("button", { name: "Start" }));
    await screen.findByRole("dialog", { name: "Test tour" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Test tour" })).toBeNull());
    expect(document.activeElement).toBe(returnFocusTarget);
  });

  it.each(["Finish", "Skip"] as const)("uses the live navigation-today target by default on %s", async (action) => {
    const user = userEvent.setup();
    render(
      <TourProvider navigate={vi.fn()}>
        <button data-tour="navigation-today" type="button">Today</button>
        <button data-tour="one" type="button">First target</button>
        <button data-tour="two" type="button">Second target</button>
        <GuidedTour />
        <FirstUnlockWelcome onOpenGuide={vi.fn()} />
      </TourProvider>,
    );

    const navigationToday = screen.getByRole("button", { name: "Today" });
    await user.click(screen.getByRole("button", { name: "Start" }));
    await screen.findByRole("dialog", { name: "Test tour" });
    if (action === "Finish") await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: action }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Test tour" })).toBeNull());
    expect(document.activeElement).toBe(navigationToday);
  });
});
