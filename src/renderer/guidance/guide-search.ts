import { guideChapters, guideChecklists, glossaryEntries } from "./guide-content";
import { GUIDE_VERSION, type GuidanceProgress, type GuideSearchResult } from "./types";

function normalize(value: string): string[] {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function createResult(id: string, kind: GuideSearchResult["kind"], title: string, summary: string, searchText: string): GuideSearchResult {
  return { id, kind, title, summary, searchText };
}

const searchableItems: GuideSearchResult[] = [
  ...guideChapters.map((chapter) => createResult(
    chapter.id,
    "chapter",
    chapter.title,
    chapter.summary,
    [chapter.title, chapter.summary, ...chapter.keywords, ...chapter.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join(" "),
  )),
  ...guideChecklists.map((checklist) => createResult(
    checklist.id,
    "checklist",
    checklist.title,
    checklist.items[0] ?? "",
    [checklist.title, ...checklist.items].join(" "),
  )),
  ...glossaryEntries.map((entry) => createResult(
    `glossary:${entry.term}`,
    "glossary",
    entry.term,
    entry.definition,
    `${entry.term} ${entry.definition}`,
  )),
];

export function searchGuide(query: string): GuideSearchResult[] {
  const tokens = normalize(query);
  if (tokens.length === 0) return searchableItems;

  return searchableItems
    .filter((item) => {
      const textTokens = new Set(normalize(item.searchText));
      return tokens.every((token) => textTokens.has(token));
    })
    .sort((left, right) => {
      const leftTitleMatches = tokens.filter((token) => normalize(left.title).includes(token)).length;
      const rightTitleMatches = tokens.filter((token) => normalize(right.title).includes(token)).length;
      return rightTitleMatches - leftTitleMatches || left.title.localeCompare(right.title);
    });
}

export function createInitialProgress(): GuidanceProgress {
  return { version: GUIDE_VERSION, welcomeDismissed: false, completedTourIds: [], completedChapterIds: [] };
}
