// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  guideChapters,
  guideChecklists,
  glossaryEntries,
  tourDefinitions,
} from "../../src/renderer/guidance/guide-content";
import {
  createInitialProgress,
  searchGuide,
} from "../../src/renderer/guidance/guide-search";

describe("beginner guide content", () => {
  it("defines seven complete learning chapters and tours", () => {
    expect(guideChapters).toHaveLength(7);
    expect(tourDefinitions).toHaveLength(7);
    expect(tourDefinitions.every((tour) => tour.steps.length >= 3 && tour.steps.length <= 7)).toBe(true);
  });

  it("finds tax guidance by meaning and states the approved formula", () => {
    const results = searchGuide("rental tax threshold");

    expect(results[0]?.searchText).toContain("12%");
    expect(results[0]?.searchText).toContain("2,820,000");
    expect(results[0]?.searchText).toContain("600,000");
  });

  it("keeps case-insensitive search stable across uppercase and lowercase queries", () => {
    expect(searchGuide("IT LEGAL").map((result) => result.id)).toEqual(
      searchGuide("it legal").map((result) => result.id),
    );
  });

  it("includes daily, booking, weekly, month-end, and recovery checklists", () => {
    expect(guideChecklists.map((item) => item.id)).toEqual(["daily", "booking", "weekly", "month-end", "recovery"]);
    expect(glossaryEntries.length).toBeGreaterThan(20);
  });

  it("creates versioned empty local progress", () => {
    expect(createInitialProgress()).toEqual({
      version: 1,
      welcomeDismissed: false,
      completedTourIds: [],
      completedChapterIds: [],
    });
  });
});
