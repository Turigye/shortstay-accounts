import { ArrowLeft, CheckCircle2, Circle, ExternalLink, PlayCircle, Search } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import type { AppScreen } from "../components/AppShell";
import { guideChapters, guideChecklists, glossaryEntries } from "../guidance/guide-content";
import { searchGuide } from "../guidance/guide-search";
import { useTour } from "../guidance/TourProvider";
import type { GuideChapterId } from "../guidance/types";

interface HelpCenterScreenProps {
  onClose: () => void;
  onNavigate: (screen: AppScreen) => void;
}

type HelpTab = "learn" | "checklists" | "glossary";

const tabs: { id: HelpTab; label: string }[] = [
  { id: "learn", label: "Learn" },
  { id: "checklists", label: "Checklists" },
  { id: "glossary", label: "Glossary" },
];

function kindLabel(kind: "chapter" | "checklist" | "glossary"): string {
  return kind === "chapter" ? "Chapter" : kind === "checklist" ? "Checklist" : "Glossary";
}

export function HelpCenterScreen({ onClose, onNavigate }: HelpCenterScreenProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>("learn");
  const [query, setQuery] = useState("");
  const { markChapterComplete, progress, startTour } = useTour();
  const searchResults = query.trim() ? searchGuide(query) : [];

  const isComplete = (id: GuideChapterId) => progress.completedChapterIds.includes(id) || progress.completedTourIds.includes(id);
  const startChapterTour = (id: GuideChapterId) => {
    onClose();
    startTour(id, document.querySelector<HTMLElement>('[data-tour="help"]'));
  };
  const goToScreen = (screen: AppScreen) => {
    onClose();
    onNavigate(screen);
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const nextIndex = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
    const next = tabs[nextIndex];
    setActiveTab(next.id);
    document.getElementById(`help-tab-${next.id}`)?.focus();
  };

  return (
    <section aria-labelledby="help-center-title" className="help-center">
      <header className="help-toolbar">
        <button aria-label="Back to workspace" className="help-icon-button" onClick={onClose} title="Back to workspace" type="button"><ArrowLeft aria-hidden="true" size={18} /></button>
        <div>
          <h1 id="help-center-title">Help Center</h1>
          <p>Guidance for recording, reviewing, and protecting your accounts.</p>
        </div>
        <label className="help-search">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search guide</span>
          <input aria-label="Search guide" onChange={(event) => setQuery(event.target.value)} placeholder="Search guidance" type="search" value={query} />
        </label>
      </header>

      {query.trim() ? (
        <section aria-label="Search results" className="help-search-results">
          <p className="help-results-count">{searchResults.length} result{searchResults.length === 1 ? "" : "s"}</p>
          {searchResults.map((result) => (
            <article className="help-search-row" key={`${result.kind}:${result.id}`}>
              <span className="help-kind-label">{kindLabel(result.kind)}</span>
              <div><h2>{result.title}</h2><p>{result.summary}</p></div>
            </article>
          ))}
        </section>
      ) : (
        <>
          <div aria-label="Help sections" className="help-tabs" role="tablist">
            {tabs.map((tab, index) => (
              <button
                aria-controls={`help-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                id={`help-tab-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                type="button"
              >{tab.label}</button>
            ))}
          </div>

          {activeTab === "learn" ? (
            <div aria-labelledby="help-tab-learn" className="help-panel" id="help-panel-learn" role="tabpanel">
              <div className="help-section-heading"><h2>Learn the workflow</h2><p>Seven short chapters, arranged around everyday accounting work.</p></div>
              <div className="help-chapter-list">
                {guideChapters.map((chapter) => {
                  const completed = isComplete(chapter.id);
                  return (
                    <article className="help-chapter-row" key={chapter.id}>
                      <button aria-label={`Mark ${chapter.title} complete`} className="help-completion-button" data-complete={completed} onClick={() => markChapterComplete(chapter.id)} title={completed ? "Completed" : "Mark complete"} type="button">
                        {completed ? <CheckCircle2 aria-hidden="true" size={20} /> : <Circle aria-hidden="true" size={20} />}
                      </button>
                      <div className="help-chapter-copy"><h3>{chapter.title}</h3><p>{chapter.summary}</p>{completed ? <span className="help-complete-label">Completed</span> : null}</div>
                      <div className="help-row-actions">
                        <button aria-label={`Start tour: ${chapter.id}`} className="help-text-button" onClick={() => startChapterTour(chapter.id)} type="button"><PlayCircle aria-hidden="true" size={16} />Start tour</button>
                        <button aria-label={`Go to screen: ${chapter.title}`} className="help-text-button" onClick={() => goToScreen(chapter.screen)} type="button"><ExternalLink aria-hidden="true" size={16} />Go to screen</button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <section className="help-troubleshooting" aria-labelledby="troubleshooting-title">
                <div className="help-section-heading"><h2 id="troubleshooting-title">Troubleshooting</h2><p>Resolve common recordkeeping issues before changing history.</p></div>
                <dl>
                  <div><dt>Incorrect balances</dt><dd>Check the booking allocation, payment account, and any refund or reversal before recording a correction.</dd></div>
                  <div><dt>Wrong payments</dt><dd>Use a reversal or correction with a clear reason; do not silently replace the original movement.</dd></div>
                  <div><dt>Closed periods</dt><dd>Reopen only for a real correction and record why the protected month changed.</dd></div>
                  <div><dt>Missed workflow steps</dt><dd>Return to the relevant booking, payment, or expense chapter and complete the missing record in order.</dd></div>
                  <div><dt>Backup recovery</dt><dd>Confirm the backup date, then use Settings to restore only after reviewing the overwrite warning.</dd></div>
                </dl>
                <p className="help-boundary"><strong>When to consult an accountant or URA:</strong> Ask for professional advice before relying on a tax estimate, changing tax treatment, resolving a compliance question, or making a decision with legal or financial consequences.</p>
              </section>
            </div>
          ) : null}

          {activeTab === "checklists" ? (
            <div aria-labelledby="help-tab-checklists" className="help-panel" id="help-panel-checklists" role="tabpanel">
              <div className="help-section-heading"><h2>Checklists</h2><p>Use these prompts to keep recurring work on track.</p></div>
              <div className="help-reference-list">{guideChecklists.map((checklist) => <article key={checklist.id}><h3>{checklist.title}</h3><ul>{checklist.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>
            </div>
          ) : null}

          {activeTab === "glossary" ? (
            <div aria-labelledby="help-tab-glossary" className="help-panel" id="help-panel-glossary" role="tabpanel">
              <div className="help-section-heading"><h2>Glossary</h2><p>Plain-language definitions used throughout the application.</p></div>
              <dl className="help-glossary">{glossaryEntries.map((entry) => <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.definition}</dd></div>)}</dl>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
