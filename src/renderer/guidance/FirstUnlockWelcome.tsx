import { useEffect, useRef, type KeyboardEvent } from "react";

import { useTour } from "./TourProvider";

interface FirstUnlockWelcomeProps {
  onOpenGuide: () => void;
  returnFocusTarget?: HTMLElement | null;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
}

function resolveReturnFocusTarget(returnFocusTarget: HTMLElement | null | undefined): HTMLElement {
  if (returnFocusTarget?.isConnected) return returnFocusTarget;

  const navigationToday = document.querySelector<HTMLElement>('[data-tour="navigation-today"]');
  if (navigationToday?.isConnected) return navigationToday;

  // Body is persistent for the lifetime of the document and can receive programmatic focus.
  document.body.tabIndex = -1;
  return document.body;
}

export function FirstUnlockWelcome({ onOpenGuide, returnFocusTarget }: FirstUnlockWelcomeProps) {
  const { activeTour, dismissWelcome, progress, startTour } = useTour();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const hasBeenVisible = useRef(false);
  const isVisible = !progress.welcomeDismissed && !activeTour;

  useEffect(() => {
    if (isVisible && !hasBeenVisible.current) headingRef.current?.focus();
    if (isVisible) hasBeenVisible.current = true;
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

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
  }, [isVisible]);

  if (!isVisible) return null;

  const startOrientation = () => {
    dismissWelcome();
    startTour("orientation", resolveReturnFocusTarget(returnFocusTarget));
  };

  const openGuide = () => {
    dismissWelcome();
    onOpenGuide();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismissWelcome();
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
    <div aria-labelledby="first-unlock-welcome-title" aria-modal="true" className="first-unlock-welcome" onKeyDown={handleKeyDown} ref={dialogRef} role="dialog">
      <section className="welcome-panel">
        <p className="welcome-eyebrow">Getting started</p>
        <h2 id="first-unlock-welcome-title" ref={headingRef} tabIndex={-1}>Welcome to Short-Stay Accounts</h2>
        <p>Learn the workspace in a short tour, or continue working and open the guide whenever you need it.</p>
        <div className="welcome-actions">
          <button className="tour-next-button" onClick={startOrientation} type="button">Start</button>
          <button className="tour-text-button" onClick={dismissWelcome} type="button">Explore independently</button>
          <button className="tour-secondary-button" onClick={openGuide} type="button">Open guide</button>
        </div>
      </section>
    </div>
  );
}
