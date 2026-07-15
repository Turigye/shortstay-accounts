import { createContext, useContext, useRef, useState, type ReactNode } from "react";

import type { AppScreen } from "../components/AppShell";
import { tourDefinitions } from "./guide-content";
import { createInitialProgress } from "./guide-search";
import {
  GUIDANCE_STORAGE_KEY,
  type GuideChapterId,
  type GuidanceProgress,
  type TourDefinition,
} from "./types";

export interface TourContextValue {
  activeTour: TourDefinition | null;
  stepIndex: number;
  progress: GuidanceProgress;
  startTour: (id: GuideChapterId, opener?: HTMLElement | null) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  dismissWelcome: () => void;
  markChapterComplete: (id: GuideChapterId) => void;
}

interface TourProviderProps {
  children: ReactNode;
  navigate: (screen: AppScreen) => void;
}

const TourContext = createContext<TourContextValue | null>(null);
const chapterIds = new Set<GuideChapterId>(tourDefinitions.map((tour) => tour.id));

function readProgress(): GuidanceProgress {
  try {
    const stored = localStorage.getItem(GUIDANCE_STORAGE_KEY);
    if (!stored) return createInitialProgress();

    const value: unknown = JSON.parse(stored);
    if (!isGuidanceProgress(value)) return createInitialProgress();

    return value;
  } catch {
    return createInitialProgress();
  }
}

function isGuidanceProgress(value: unknown): value is GuidanceProgress {
  if (!value || typeof value !== "object") return false;
  const progress = value as Record<string, unknown>;
  return progress.version === 1
    && typeof progress.welcomeDismissed === "boolean"
    && isChapterIdList(progress.completedTourIds)
    && isChapterIdList(progress.completedChapterIds);
}

function isChapterIdList(value: unknown): value is GuideChapterId[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && chapterIds.has(id as GuideChapterId));
}

function persistProgress(progress: GuidanceProgress): void {
  localStorage.setItem(GUIDANCE_STORAGE_KEY, JSON.stringify(progress));
}

function addUnique(ids: GuideChapterId[], id: GuideChapterId): GuideChapterId[] {
  return ids.includes(id) ? ids : [...ids, id];
}

export function TourProvider({ children, navigate }: TourProviderProps) {
  const [progress, setProgress] = useState(readProgress);
  const progressRef = useRef(progress);
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const openerRef = useRef<HTMLElement | null>(null);

  const updateProgress = (update: (current: GuidanceProgress) => GuidanceProgress) => {
    const next = update(progressRef.current);
    progressRef.current = next;
    persistProgress(next);
    setProgress(next);
  };

  const restoreOpenerFocus = () => {
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener) requestAnimationFrame(() => opener.focus());
  };

  const closeTour = (completed: boolean) => {
    const tour = activeTour;
    if (!tour) return;

    if (completed) {
      updateProgress((current) => ({
        ...current,
        completedTourIds: addUnique(current.completedTourIds, tour.id),
      }));
    }
    setActiveTour(null);
    setStepIndex(0);
    restoreOpenerFocus();
  };

  const startTour = (id: GuideChapterId, opener?: HTMLElement | null) => {
    const tour = tourDefinitions.find((definition) => definition.id === id);
    const firstStep = tour?.steps[0];
    if (!tour || !firstStep) return;

    navigate(firstStep.screen);
    openerRef.current = opener ?? null;
    setStepIndex(0);
    setActiveTour(tour);
  };

  const nextStep = () => {
    if (!activeTour) return;
    const nextIndex = stepIndex + 1;
    const next = activeTour.steps[nextIndex];
    if (!next) {
      closeTour(true);
      return;
    }

    navigate(next.screen);
    setStepIndex(nextIndex);
  };

  const previousStep = () => {
    if (!activeTour || stepIndex === 0) return;
    const previousIndex = stepIndex - 1;
    const previous = activeTour.steps[previousIndex];
    if (!previous) return;

    navigate(previous.screen);
    setStepIndex(previousIndex);
  };

  const value: TourContextValue = {
    activeTour,
    stepIndex,
    progress,
    startTour,
    nextStep,
    previousStep,
    skipTour: () => closeTour(false),
    completeTour: () => closeTour(true),
    dismissWelcome: () => updateProgress((current) => ({ ...current, welcomeDismissed: true })),
    markChapterComplete: (id) => updateProgress((current) => ({
      ...current,
      completedChapterIds: addUnique(current.completedChapterIds, id),
    })),
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const value = useContext(TourContext);
  if (!value) throw new Error("useTour must be used within a TourProvider");
  return value;
}
