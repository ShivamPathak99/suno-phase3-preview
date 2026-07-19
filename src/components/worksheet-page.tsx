"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { readingLevels } from "@/lib/analysisSchema";
import { type WorksheetLevel, worksheetPath } from "@/lib/worksheet-route";
import {
  type WorksheetContent,
  type WorksheetRequest,
  worksheetContentSchema,
} from "@/lib/worksheetSchema";

type WorksheetPageProps = {
  language: WorksheetRequest["language"];
  level: WorksheetLevel;
};

const levelLabels: Record<WorksheetLevel, string> = {
  letter: "Letter",
  word: "Word",
  paragraph: "Paragraph",
  story: "Story",
};

function LevelIcon({ level }: { level: WorksheetLevel }) {
  if (level === "letter") {
    return <span className="worksheet-letter-icon">A</span>;
  }

  if (level === "story") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="M4.5 5.5c3.2-1.1 5.7-.5 7.5 1.5 1.8-2 4.3-2.6 7.5-1.5v12c-3.2-1.1-5.7-.5-7.5 1.5-1.8-2-4.3-2.6-7.5-1.5zM12 7v12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      {level === "word" ? (
        <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      ) : (
        <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      )}
    </svg>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M7 8V4.5h10V8M7 16H5.5A1.5 1.5 0 0 1 4 14.5v-5A1.5 1.5 0 0 1 5.5 8h13A1.5 1.5 0 0 1 20 9.5v5a1.5 1.5 0 0 1-1.5 1.5H17M7 13h10v6.5H7z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M17 11.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

function userFacingGenerationError(error: unknown, timedOut: boolean) {
  if (timedOut) {
    return "This is taking too long. Try once more.";
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "This is taking too long. Try once more.";
  }

  return "Couldn't make this reading card. Try generating it again.";
}

export function WorksheetPage({ language, level }: WorksheetPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [worksheet, setWorksheet] = useState<WorksheetContent | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const requestNumberRef = useRef(0);

  const generateWorksheet = useCallback(
    async (clearExisting: boolean) => {
      activeRequestRef.current?.abort();

      const requestNumber = requestNumberRef.current + 1;
      const controller = new AbortController();
      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 45_000);

      requestNumberRef.current = requestNumber;
      activeRequestRef.current = controller;
      setError(null);
      setIsGenerating(true);

      if (clearExisting) {
        setWorksheet(null);
      }

      try {
        const response = await fetch("/api/worksheets", {
          body: JSON.stringify({ language, level }),
          headers: { "content-type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error("Worksheet request was not successful.");
        }

        const parsed = worksheetContentSchema.safeParse(payload);

        if (!parsed.success) {
          throw new Error("Worksheet response did not match the frozen content contract.");
        }

        if (requestNumber === requestNumberRef.current) {
          setWorksheet(parsed.data);
        }
      } catch (generationError) {
        if (requestNumber === requestNumberRef.current) {
          setError(userFacingGenerationError(generationError, timedOut));
        }
      } finally {
        window.clearTimeout(timeout);

        if (requestNumber === requestNumberRef.current) {
          activeRequestRef.current = null;
          setIsGenerating(false);
        }
      }
    },
    [language, level],
  );

  useEffect(() => {
    // Defer one tick so React development Strict Mode cleans up its first
    // effect pass before a billable generation request begins.
    const initialRequest = window.setTimeout(() => {
      void generateWorksheet(true);
    }, 0);

    return () => {
      window.clearTimeout(initialRequest);
      requestNumberRef.current += 1;
      activeRequestRef.current?.abort();
    };
  }, [generateWorksheet]);

  const levelLabel = levelLabels[level];
  const hasWorksheet = worksheet !== null;

  return (
    <main className="worksheet-page">
      <section className="worksheet-shell" aria-labelledby="worksheet-heading">
        <header className="worksheet-screen-chrome worksheet-screen-header">
          <div className="worksheet-toolbar">
            <Link className="worksheet-back-link" href="/">
              <BackIcon />
              <span>Back to class</span>
            </Link>

            <div className="worksheet-actions">
              <button
                className="primary-action worksheet-print-action"
                disabled={!hasWorksheet || isGenerating}
                onClick={() => window.print()}
                type="button"
              >
                <PrintIcon />
                Print reading cards
              </button>
              <button
                className="quiet-action worksheet-regenerate-action"
                disabled={isGenerating}
                onClick={() => void generateWorksheet(false)}
                type="button"
              >
                Regenerate
              </button>
            </div>
          </div>

          <nav aria-label="Worksheet reading levels" className="worksheet-level-ladder">
            {readingLevels.map((ladderLevel) => {
              const isCurrent = ladderLevel === level;

              return (
                <Link
                  aria-current={isCurrent ? "page" : undefined}
                  className={
                    "worksheet-ladder-chip level-" + ladderLevel + (isCurrent ? " is-current" : "")
                  }
                  href={worksheetPath(ladderLevel)}
                  key={ladderLevel}
                >
                  <span aria-hidden="true" className="worksheet-ladder-icon">
                    <LevelIcon level={ladderLevel} />
                  </span>
                  <span>{levelLabels[ladderLevel]}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        <article
          aria-busy={isGenerating}
          className="worksheet-sheet"
          data-level={level}
        >
          <header className="worksheet-sheet-header">
            <div className={"worksheet-sheet-heading level-" + level}>
              <span aria-hidden="true" className="worksheet-sheet-level-icon">
                <LevelIcon level={level} />
              </span>
              <h1 id="worksheet-heading">Reading practice · {levelLabel} level</h1>
            </div>
            <div aria-label="Student details" className="worksheet-fields">
              <span>Name</span>
              <span aria-hidden="true" className="worksheet-field-line" />
              <span>Date</span>
              <span aria-hidden="true" className="worksheet-field-line" />
            </div>
          </header>

          <section className="worksheet-sheet-content">
            {worksheet ? (
              <div className="worksheet-reading-area">
                <h2>{worksheet.title}</h2>
                <p className="worksheet-reading-text" lang={language}>
                  {worksheet.body}
                </p>
              </div>
            ) : null}

            {isGenerating && !worksheet ? (
              <div aria-live="polite" className="worksheet-message worksheet-loading" role="status">
                <p>Preparing a level-matched reading card</p>
                <span>It will be ready to print in a moment.</span>
              </div>
            ) : null}

            {error && !worksheet ? (
              <div aria-live="polite" className="worksheet-message worksheet-error" role="alert">
                <p>Couldn&apos;t make this reading card</p>
                <span>{error}</span>
                <button className="primary-action" onClick={() => void generateWorksheet(true)} type="button">
                  Try again
                </button>
              </div>
            ) : null}
          </section>

          {worksheet ? (
            <footer className="worksheet-footer">
              <div className="worksheet-question-area">
                <p className="worksheet-question">{worksheet.question}</p>
                <div aria-label="Answer lines" className="worksheet-answer-lines">
                  <span />
                  <span />
                </div>
              </div>
              <p className="worksheet-brand">Suno · suno.app</p>
            </footer>
          ) : null}
        </article>

        {isGenerating && worksheet ? (
          <p aria-live="polite" className="worksheet-screen-chrome worksheet-regeneration-status" role="status">
            Generating a new reading card…
          </p>
        ) : null}

        {error && worksheet ? (
          <div aria-live="polite" className="worksheet-screen-chrome worksheet-regeneration-error" role="alert">
            <p>{error}</p>
            <button className="quiet-action" onClick={() => void generateWorksheet(false)} type="button">
              Try again
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
