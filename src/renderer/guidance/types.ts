import type { AppScreen } from "../components/AppShell";

export type GuideChapterId = "orientation" | "bookings" | "money" | "staff" | "month-end" | "reports" | "administration";
export type GuideChecklistId = "daily" | "booking" | "weekly" | "month-end" | "recovery";

export interface TourStep {
  id: string;
  screen: AppScreen;
  target: string;
  title: string;
  body: string;
  placement?: "top" | "right" | "bottom" | "left";
}

export interface TourDefinition {
  id: GuideChapterId;
  title: string;
  summary: string;
  steps: TourStep[];
}

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface GuideChapter {
  id: GuideChapterId;
  title: string;
  summary: string;
  screen: AppScreen;
  keywords: string[];
  sections: GuideSection[];
}

export interface GuideChecklist {
  id: GuideChecklistId;
  title: string;
  items: string[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface GuidanceProgress {
  version: 1;
  welcomeDismissed: boolean;
  completedTourIds: GuideChapterId[];
  completedChapterIds: GuideChapterId[];
}

export interface GuideSearchResult {
  id: string;
  kind: "chapter" | "glossary" | "checklist";
  title: string;
  summary: string;
  searchText: string;
}

export const GUIDE_VERSION = 1 as const;
export const GUIDANCE_STORAGE_KEY = "shortstay-guidance:v1";
