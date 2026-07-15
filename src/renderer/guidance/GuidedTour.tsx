import { ArrowLeft, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { useTour } from "./TourProvider";
import type { TourStep } from "./types";

const DISCOVERY_INTERVAL_MS = 50;
const DISCOVERY_TIMEOUT_MS = 1_000;
const SPOTLIGHT_PADDING = 8;
const VIEWPORT_MARGIN = 16;
const PANEL_GAP = 12;
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 236;

type Placement = NonNullable<TourStep["placement"]>;

interface SpotlightRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface PanelPosition {
  left: number;
  top: number;
  placement: Placement;
}

function getSpotlightRect(target: Element): SpotlightRect {
  const rect = target.getBoundingClientRect();
  const left = Math.max(0, rect.left - SPOTLIGHT_PADDING);
  const top = Math.max(0, rect.top - SPOTLIGHT_PADDING);
  const right = Math.min(window.innerWidth, rect.right + SPOTLIGHT_PADDING);
  const bottom = Math.min(window.innerHeight, rect.bottom + SPOTLIGHT_PADDING);

  return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function getPanelPosition(rect: SpotlightRect, requested: Placement | undefined, panelSize: { width: number; height: number }): PanelPosition {
  const width = Math.min(panelSize.width, Math.max(0, window.innerWidth - (VIEWPORT_MARGIN * 2)));
  const height = Math.min(panelSize.height, Math.max(0, window.innerHeight - (VIEWPORT_MARGIN * 2)));
  const freeSpace: Record<Placement, number> = {
    top: rect.top - VIEWPORT_MARGIN,
    right: window.innerWidth - rect.right - VIEWPORT_MARGIN,
    bottom: window.innerHeight - rect.bottom - VIEWPORT_MARGIN,
    left: rect.left - VIEWPORT_MARGIN,
  };
  const requestedPlacement = requested ?? "bottom";
  const requiredSpace: Record<Placement, number> = { top: height + PANEL_GAP, right: width + PANEL_GAP, bottom: height + PANEL_GAP, left: width + PANEL_GAP };
  const placements: Placement[] = ["top", "right", "bottom", "left"];
  const fittingPlacements = placements.filter((candidate) => freeSpace[candidate] >= requiredSpace[candidate]);
  const fallbackPlacement = fittingPlacements.sort((first, second) => freeSpace[second] - freeSpace[first])[0];
  const placement = freeSpace[requestedPlacement] >= requiredSpace[requestedPlacement]
    ? requestedPlacement
    : fallbackPlacement ?? (Object.entries(freeSpace).sort(([, first], [, second]) => second - first)[0]?.[0] as Placement ?? "bottom");
  const horizontalCenter = rect.left + (rect.width / 2) - (width / 2);
  const verticalCenter = rect.top + (rect.height / 2) - (height / 2);

  if (placement === "top") {
    return { placement, left: clamp(horizontalCenter, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN), top: clamp(rect.top - height - PANEL_GAP, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN) };
  }
  if (placement === "right") {
    return { placement, left: clamp(rect.right + PANEL_GAP, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN), top: clamp(verticalCenter, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN) };
  }
  if (placement === "left") {
    return { placement, left: clamp(rect.left - width - PANEL_GAP, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN), top: clamp(verticalCenter, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN) };
  }
  return { placement, left: clamp(horizontalCenter, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN), top: clamp(rect.bottom + PANEL_GAP, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN) };
}

function targetSelector(target: string): string {
  const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(target) : target.replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
  return `[data-tour="${escaped}"]`;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
}

export function GuidedTour() {
  const { activeTour, completeTour, nextStep, previousStep, skipTour, stepIndex } = useTour();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [panelSize, setPanelSize] = useState({ width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const targetRef = useRef<Element | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const step = activeTour?.steps[stepIndex];

  useEffect(() => {
    targetRef.current = null;
    setSpotlight(null);
    if (!activeTour || !step) return;

    let attempts = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const discoverTarget = () => {
      const target = document.querySelector(targetSelector(step.target));
      if (target) {
        targetRef.current = target;
        setSpotlight(getSpotlightRect(target));
        return;
      }
      if (attempts >= DISCOVERY_TIMEOUT_MS / DISCOVERY_INTERVAL_MS) {
        if (import.meta.env.DEV) console.warn(`Guided tour target not found: ${step.target}`);
        nextStep();
        return;
      }
      attempts += 1;
      timeout = setTimeout(discoverTarget, DISCOVERY_INTERVAL_MS);
    };

    discoverTarget();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [activeTour, nextStep, step]);

  useEffect(() => {
    if (!spotlight || !targetRef.current) return;
    const updateGeometry = () => setSpotlight(getSpotlightRect(targetRef.current!));
    window.addEventListener("resize", updateGeometry);
    window.addEventListener("scroll", updateGeometry, true);
    return () => {
      window.removeEventListener("resize", updateGeometry);
      window.removeEventListener("scroll", updateGeometry, true);
    };
  }, [spotlight]);

  useLayoutEffect(() => {
    if (!spotlight || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setPanelSize((current) => current.width === rect.width && current.height === rect.height ? current : { width: rect.width, height: rect.height });
  }, [spotlight, step]);

  useEffect(() => {
    if (spotlight) headingRef.current?.focus();
  }, [spotlight, stepIndex]);

  useEffect(() => {
    if (!activeTour) return;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const isInsideDialog = (target: EventTarget | null) => target instanceof Node && dialogRef.current?.contains(target);
    const blockBackgroundInteraction = (event: MouseEvent | PointerEvent) => {
      if (isInsideDialog(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const retainFocus = (event: FocusEvent) => {
      if (isInsideDialog(event.target)) return;
      focusTimer = setTimeout(() => {
        if (dialogRef.current?.isConnected) headingRef.current?.focus();
      }, 0);
    };

    document.addEventListener("pointerdown", blockBackgroundInteraction, true);
    document.addEventListener("click", blockBackgroundInteraction, true);
    document.addEventListener("focusin", retainFocus, true);
    return () => {
      document.removeEventListener("pointerdown", blockBackgroundInteraction, true);
      document.removeEventListener("click", blockBackgroundInteraction, true);
      document.removeEventListener("focusin", retainFocus, true);
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [activeTour]);

  if (!activeTour || !step || !spotlight) return null;

  const panelPosition = getPanelPosition(spotlight, step.placement, panelSize);
  const spotlightStyle = {
    left: `${spotlight.left}px`,
    top: `${spotlight.top}px`,
    width: `${spotlight.width}px`,
    height: `${spotlight.height}px`,
  } satisfies CSSProperties;
  const panelStyle = { left: `${panelPosition.left}px`, top: `${panelPosition.top}px` } satisfies CSSProperties;
  const isFinalStep = stepIndex === activeTour.steps.length - 1;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      skipTour();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = focusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div aria-label={activeTour.title} aria-modal="true" className="guided-tour" onKeyDown={handleKeyDown} ref={dialogRef} role="dialog">
      <div aria-hidden="true" className="tour-dimmer tour-dimmer-top" style={{ height: `${spotlight.top}px` }} />
      <div aria-hidden="true" className="tour-dimmer tour-dimmer-bottom" style={{ height: `${window.innerHeight - spotlight.bottom}px` }} />
      <div aria-hidden="true" className="tour-dimmer tour-dimmer-left" style={{ height: `${spotlight.height}px`, top: `${spotlight.top}px`, width: `${spotlight.left}px` }} />
      <div aria-hidden="true" className="tour-dimmer tour-dimmer-right" style={{ height: `${spotlight.height}px`, left: `${spotlight.right}px`, top: `${spotlight.top}px`, width: `${window.innerWidth - spotlight.right}px` }} />
      <div aria-hidden="true" className="tour-spotlight-focus" style={spotlightStyle} />

      <section className="tour-panel" data-placement={panelPosition.placement} ref={panelRef} style={panelStyle}>
        <div className="tour-panel-header">
          <p className="tour-progress">Step {stepIndex + 1} of {activeTour.steps.length}</p>
          <button aria-label="Close tour" className="tour-icon-button" onClick={skipTour} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <h2 id="guided-tour-title" ref={headingRef} tabIndex={-1}>{step.title}</h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-panel-actions">
          <button className="tour-text-button" onClick={skipTour} type="button">Skip</button>
          <span className="tour-action-spacer" />
          {stepIndex > 0 ? <button aria-label="Back" className="tour-icon-button" onClick={previousStep} type="button"><ArrowLeft aria-hidden="true" size={18} /></button> : null}
          <button className="tour-next-button" onClick={isFinalStep ? completeTour : nextStep} type="button">{isFinalStep ? "Finish" : "Next"}</button>
        </div>
      </section>
    </div>
  );
}
