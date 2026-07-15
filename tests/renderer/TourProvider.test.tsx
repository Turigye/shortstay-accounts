// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourProvider, useTour } from "../../src/renderer/guidance/TourProvider";
import { GUIDANCE_STORAGE_KEY, type GuideChapterId, type TourDefinition } from "../../src/renderer/guidance/types";

const { tour } = vi.hoisted(() => ({ tour: {
  id: "orientation",
  title: "Test tour",
  summary: "A test-only tour.",
  steps: [
    { id: "one", screen: "today", target: "one", title: "One", body: "First step." },
    { id: "two", screen: "bookings", target: "two", title: "Two", body: "Second step." },
    { id: "three", screen: "payments", target: "three", title: "Three", body: "Third step." },
  ],
} satisfies TourDefinition }));

vi.mock("../../src/renderer/guidance/guide-content", async (importOriginal) => ({
  ...(await importOriginal()),
  tourDefinitions: [tour],
}));

function Consumer(): ReactNode {
  const context = useTour();
  return <output data-testid="tour-state">{JSON.stringify({
    activeTour: context.activeTour?.id ?? null,
    stepIndex: context.stepIndex,
    progress: context.progress,
  })}</output>;
}

function readState() {
  return JSON.parse(screen.getByTestId("tour-state").textContent ?? "{}") as {
    activeTour: GuideChapterId | null;
    stepIndex: number;
    progress: {
      version: number;
      welcomeDismissed: boolean;
      completedTourIds: GuideChapterId[];
      completedChapterIds: GuideChapterId[];
    };
  };
}

function renderProvider(navigate = vi.fn()) {
  let context: ReturnType<typeof useTour> | undefined;
  render(
    <TourProvider navigate={navigate}>
      <Consumer />
      <Capture onValue={(value) => { context = value; }} />
    </TourProvider>,
  );
  return { context: () => context!, navigate };
}

function Capture({ onValue }: { onValue: (value: ReturnType<typeof useTour>) => void }): null {
  onValue(useTour());
  return null;
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TourProvider", () => {
  it("starts with fresh local progress", () => {
    renderProvider();

    expect(readState()).toEqual({
      activeTour: null,
      stepIndex: 0,
      progress: { version: 1, welcomeDismissed: false, completedTourIds: [], completedChapterIds: [] },
    });
  });

  it("recovers from malformed stored progress", () => {
    localStorage.setItem(GUIDANCE_STORAGE_KEY, "not-json");

    renderProvider();

    expect(readState().progress).toEqual({ version: 1, welcomeDismissed: false, completedTourIds: [], completedChapterIds: [] });
  });

  it("starts a tour by navigating to its first step", () => {
    const { context, navigate } = renderProvider();

    act(() => context().startTour("orientation"));

    expect(navigate).toHaveBeenCalledWith("today");
    expect(readState()).toMatchObject({ activeTour: "orientation", stepIndex: 0 });
  });

  it("moves forward and backward while navigating before each step is exposed", () => {
    const { context, navigate } = renderProvider();

    act(() => context().startTour("orientation"));
    act(() => context().nextStep());
    expect(navigate).toHaveBeenLastCalledWith("bookings");
    expect(readState()).toMatchObject({ activeTour: "orientation", stepIndex: 1 });

    act(() => context().previousStep());
    expect(navigate).toHaveBeenLastCalledWith("today");
    expect(readState()).toMatchObject({ activeTour: "orientation", stepIndex: 0 });
  });

  it("completes a tour and persists its progress", () => {
    const { context } = renderProvider();
    act(() => context().startTour("orientation"));
    act(() => context().completeTour());

    expect(readState()).toMatchObject({ activeTour: null, progress: { completedTourIds: ["orientation"] } });
    expect(JSON.parse(localStorage.getItem(GUIDANCE_STORAGE_KEY) ?? "{}")).toMatchObject({
      version: 1,
      completedTourIds: ["orientation"],
    });
  });

  it("skips a tour without marking it complete", () => {
    const { context } = renderProvider();
    act(() => context().startTour("orientation"));
    act(() => context().skipTour());

    expect(readState()).toMatchObject({ activeTour: null, progress: { completedTourIds: [] } });
  });

  it("persists welcome dismissal and chapter completion", () => {
    const { context } = renderProvider();

    act(() => context().dismissWelcome());
    act(() => context().markChapterComplete("bookings"));

    expect(readState().progress).toMatchObject({ welcomeDismissed: true, completedChapterIds: ["bookings"] });
    expect(JSON.parse(localStorage.getItem(GUIDANCE_STORAGE_KEY) ?? "{}")).toMatchObject({
      welcomeDismissed: true,
      completedChapterIds: ["bookings"],
    });
  });

  it("restores focus to the opener after closing a tour", () => {
    const { context } = renderProvider();
    const opener = document.createElement("button");
    const focus = vi.spyOn(HTMLElement.prototype, "focus");

    act(() => context().startTour("orientation", opener));
    act(() => context().skipTour());

    expect(focus).toHaveBeenCalledOnce();
  });
});
