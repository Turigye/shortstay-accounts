import { useEffect, useRef } from "react";

import { useTour } from "./TourProvider";

interface FirstUnlockWelcomeProps {
  onOpenGuide: () => void;
}

export function FirstUnlockWelcome({ onOpenGuide }: FirstUnlockWelcomeProps) {
  const { activeTour, dismissWelcome, progress, startTour } = useTour();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const hasBeenVisible = useRef(false);
  const isVisible = !progress.welcomeDismissed && !activeTour;

  useEffect(() => {
    if (isVisible && !hasBeenVisible.current) headingRef.current?.focus();
    if (isVisible) hasBeenVisible.current = true;
  }, [isVisible]);

  if (!isVisible) return null;

  const startOrientation = () => {
    dismissWelcome();
    startTour("orientation");
  };

  const openGuide = () => {
    dismissWelcome();
    onOpenGuide();
  };

  return (
    <div aria-labelledby="first-unlock-welcome-title" aria-modal="true" className="first-unlock-welcome" role="dialog">
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
