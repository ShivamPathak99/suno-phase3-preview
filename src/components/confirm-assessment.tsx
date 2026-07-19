"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ReadingAnalysis } from "@/lib/analysisSchema";
import type { MockAssessmentContext, ReadingLevel } from "@/lib/mock-assessment";

type WordStatus = ReadingAnalysis["words"][number]["status"];

type WordOverride = {
  heard_as: string | null;
  status: WordStatus;
};

type EditorPosition = {
  left: number;
  top: number;
};

type PassageFragment =
  | { kind: "plain"; value: string }
  | { kind: "space"; value: string }
  | { index: number; kind: "word"; prefix: string; suffix: string; value: string };

type ConfirmAssessmentProps = {
  context: MockAssessmentContext;
  mockAnalysis: ReadingAnalysis;
};

const levelLabels: Record<ReadingLevel, string> = {
  letter: "Letter",
  word: "Word",
  paragraph: "Paragraph",
  story: "Story",
};

const statusLabels: Record<WordStatus, string> = {
  correct: "read correctly",
  hesitation: "hesitation",
  skipped: "skipped",
  substituted: "substituted",
  unclear: "unclear",
};

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m14.5 5-7 7 7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m5 12.5 4.3 4.3L19 7.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function StoryIcon() {
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

function LevelMark({ level }: { level: ReadingLevel }) {
  if (level === "story") {
    return <StoryIcon />;
  }

  return <span>{level === "letter" ? "A" : level === "word" ? "—" : "≡"}</span>;
}

function splitPassage(body: string): PassageFragment[] {
  let wordIndex = 0;

  return body
    .split(/(\s+)/u)
    .filter((fragment) => fragment.length > 0)
    .map((fragment) => {
      if (/^\s+$/u.test(fragment)) {
        return { kind: "space", value: fragment };
      }

      const characters = Array.from(fragment);
      const firstWordCharacter = characters.findIndex((character) =>
        /[\p{L}\p{M}\p{N}]/u.test(character),
      );

      if (firstWordCharacter === -1) {
        return { kind: "plain", value: fragment };
      }

      let lastWordCharacter = characters.length - 1;
      while (
        lastWordCharacter >= firstWordCharacter &&
        !/[\p{L}\p{M}\p{N}]/u.test(characters[lastWordCharacter] ?? "")
      ) {
        lastWordCharacter -= 1;
      }

      const result: PassageFragment = {
        index: wordIndex,
        kind: "word",
        prefix: characters.slice(0, firstWordCharacter).join(""),
        suffix: characters.slice(lastWordCharacter + 1).join(""),
        value: characters.slice(firstWordCharacter, lastWordCharacter + 1).join(""),
      };

      wordIndex += 1;
      return result;
    });
}

function formatMetric(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function displaySummary(summary: string, studentName: string) {
  /**
   * The frozen fixture names and genders Ravi. This display adapter keeps the
   * mock analysis object immutable while making the seeded demo roster read
   * naturally for every child.
   */
  return summary.replace(/\bRavi\b/gu, studentName).replace(/\bHe\b/gu, "The student");
}

export function ConfirmAssessment({ context, mockAnalysis }: ConfirmAssessmentProps) {
  const [overrides, setOverrides] = useState<Record<number, WordOverride>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [heardAsDraft, setHeardAsDraft] = useState("");
  const [editorPosition, setEditorPosition] = useState<EditorPosition | null>(null);
  const [overrideNotice, setOverrideNotice] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const confirmTimerRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const fragments = useMemo(() => splitPassage(context.passage.body), [context.passage.body]);
  const reviewedWords = useMemo(
    () =>
      mockAnalysis.words.map((word, index) => {
        const override = overrides[index];
        return override ? { ...word, ...override } : word;
      }),
    [mockAnalysis.words, overrides],
  );
  const selectedWord = selectedIndex === null ? null : reviewedWords[selectedIndex] ?? null;
  const levelClassName = "level-" + mockAnalysis.level;
  const editorStyle = editorPosition
    ? ({
        "--editor-left": editorPosition.left + "px",
        "--editor-top": editorPosition.top + "px",
      } as CSSProperties)
    : undefined;

  const closeEditor = useCallback(() => {
    setSelectedIndex(null);
    setEditorPosition(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openWordEditor = useCallback(
    (index: number, trigger: HTMLButtonElement) => {
      const currentWord = reviewedWords[index];
      if (!currentWord) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const maximumLeft = Math.max(16, window.innerWidth - 336);
      const editorHeight = Math.min(360, Math.max(0, window.innerHeight - 32));
      const maximumTop = Math.max(16, window.innerHeight - editorHeight - 16);

      triggerRef.current = trigger;
      setHeardAsDraft(currentWord.heard_as ?? "");
      setEditorPosition({
        left: Math.min(Math.max(16, rect.left), maximumLeft),
        top: Math.min(rect.bottom + 8, maximumTop),
      });
      setSelectedIndex(index);
    },
    [reviewedWords],
  );

  const applyOverride = useCallback(
    (status: WordStatus, heardAs: string | null, description: string) => {
      if (selectedIndex === null || !selectedWord) {
        return;
      }

      setOverrides((current) => ({
        ...current,
        [selectedIndex]: { heard_as: heardAs, status },
      }));
      setOverrideNotice(selectedWord.passage_word + " " + description + ".");
      closeEditor();
    },
    [closeEditor, selectedIndex, selectedWord],
  );

  const saveHeardAs = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const heardAs = heardAsDraft.trim();

      if (!heardAs) {
        return;
      }

      applyOverride("substituted", heardAs, "updated as heard " + heardAs);
    },
    [applyOverride, heardAsDraft],
  );

  const confirmLevel = useCallback(() => {
    if (isConfirming || isConfirmed) {
      return;
    }

    setIsConfirming(true);
    confirmTimerRef.current = window.setTimeout(() => {
      setIsConfirming(false);
      setIsConfirmed(true);
      setToastMessage(
        context.student.name +
          " confirmed at " +
          levelLabels[mockAnalysis.level].toLowerCase() +
          " level",
      );
    }, 250);
  }, [context.student.name, isConfirmed, isConfirming, mockAnalysis.level]);

  useEffect(() => {
    if (selectedIndex === null) {
      return undefined;
    }

    const focusDialog = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-editor-initial-focus]")?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEditor();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled])',
        ),
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusDialog);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeEditor, selectedIndex]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const hideToast = window.setTimeout(() => setToastMessage(""), 3_000);
    return () => window.clearTimeout(hideToast);
  }, [toastMessage]);

  useEffect(
    () => () => {
      if (confirmTimerRef.current !== null) {
        window.clearTimeout(confirmTimerRef.current);
      }
    },
    [],
  );

  return (
    <main
      className="assessment-page confirmation-page"
      data-assessment-id={context.assessmentId}
      data-mock-only="true"
    >
      <section className="assessment-shell confirm-shell" aria-labelledby="confirm-title">
        <header className="confirm-header">
          <Link
            aria-label={"Back to " + context.student.name + "'s reading check"}
            className="back-link"
            href={"/assess/" + context.student.id}
          >
            <BackIcon />
          </Link>
          <h1 id="confirm-title">
            {context.student.name}
            <span aria-hidden="true"> · attempt {context.attemptNumber}</span>
          </h1>
        </header>

        <div className="confirm-layout">
          <section className="confirm-passage-column" aria-labelledby="marked-passage-title">
            <article className="ruled-passage confirm-passage" lang={context.passage.language}>
              <p className="passage-title" id="marked-passage-title">
                {context.passage.title} · Tap a word to review it
              </p>
              <p className="passage-text confirm-passage-text">
                {fragments.map((fragment, fragmentIndex) => {
                  if (fragment.kind === "space") {
                    return (
                      <span aria-hidden="true" key={"space-" + fragmentIndex}>
                        {fragment.value}
                      </span>
                    );
                  }

                  if (fragment.kind === "plain") {
                    return <span key={"plain-" + fragmentIndex}>{fragment.value}</span>;
                  }

                  const word = reviewedWords[fragment.index];
                  if (!word) {
                    return (
                      <span key={"word-" + fragmentIndex}>
                        {fragment.prefix}
                        {fragment.value}
                        {fragment.suffix}
                      </span>
                    );
                  }

                  const hasOverride = overrides[fragment.index] !== undefined;
                  const isLowConfidence = word.confidence === "low";
                  const wordClassName = [
                    "review-word",
                    "word-status-" + word.status,
                    hasOverride ? "is-overridden" : "",
                    isLowConfidence ? "is-low-confidence" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const heardAs = word.heard_as ? ", heard as " + word.heard_as : "";
                  const overrideApplied = hasOverride ? ", teacher override applied" : "";

                  return (
                    <span key={"word-" + fragmentIndex}>
                      {fragment.prefix}
                      <button
                        aria-haspopup="dialog"
                        aria-label={
                          word.passage_word +
                          ", " +
                          statusLabels[word.status] +
                          ", " +
                          word.confidence +
                          " confidence" +
                          heardAs +
                          overrideApplied +
                          ". Review this word."
                        }
                        className={wordClassName}
                        onClick={(event) => openWordEditor(fragment.index, event.currentTarget)}
                        type="button"
                      >
                        {fragment.value}
                        {word.status === "unclear" ? (
                          <sup aria-hidden="true" className="unclear-question">
                            ?
                          </sup>
                        ) : null}
                        {hasOverride ? (
                          <span aria-hidden="true" className="word-override-tick">
                            <CheckIcon />
                          </span>
                        ) : null}
                      </button>
                      {fragment.suffix}
                    </span>
                  );
                })}
              </p>
            </article>

            <p className="word-legend" id="word-mark-legend">
              <span>Marks:</span>
              <span className="legend-token word-status-skipped">skip</span>
              <span className="legend-token word-status-substituted">heard</span>
              <span className="legend-token word-status-hesitation">pause</span>
              <span className="legend-token word-status-unclear">unclear?</span>
              <span className="legend-low-confidence">check</span>
            </p>
          </section>

          <aside className="confirm-summary-rail" aria-label="Assessment result">
            <section className={"level-result-card " + levelClassName}>
              <div className="level-result-heading">
                <span aria-hidden="true" className="level-result-icon">
                  <LevelMark level={mockAnalysis.level} />
                </span>
                <div>
                  <p>Suggested reading level</p>
                  <h2>{levelLabels[mockAnalysis.level]} level</h2>
                </div>
              </div>
              <dl className="result-metrics">
                <div>
                  <dt>Speed</dt>
                  <dd>{formatMetric(mockAnalysis.wcpm)} WCPM</dd>
                </div>
                <div>
                  <dt>Accuracy</dt>
                  <dd>{formatMetric(mockAnalysis.accuracy_pct)}%</dd>
                </div>
              </dl>
            </section>

            <blockquote className="teacher-summary">
              “{displaySummary(mockAnalysis.summary_for_teacher, context.student.name)}”
            </blockquote>

            <button
              aria-busy={isConfirming}
              className="primary-action confirm-level-action"
              disabled={isConfirming || isConfirmed}
              onClick={confirmLevel}
              type="button"
            >
              {isConfirmed ? (
                <>
                  Confirmed <CheckIcon />
                </>
              ) : isConfirming ? (
                "Confirming…"
              ) : (
                <>
                  Confirm level <CheckIcon />
                </>
              )}
            </button>
            <Link className="quiet-action confirm-rerecord" href={"/assess/" + context.student.id}>
              Re-record
            </Link>
          </aside>
        </div>

        <p aria-live="polite" className="sr-only">
          {overrideNotice}
        </p>
      </section>

      {selectedIndex !== null && selectedWord ? (
        <>
          <button
            aria-label="Close word editor"
            className="word-editor-backdrop"
            onClick={closeEditor}
            type="button"
          />
          <aside
            aria-labelledby="word-editor-title"
            aria-modal="true"
            className="word-editor"
            ref={dialogRef}
            role="dialog"
            style={editorStyle}
          >
            <span aria-hidden="true" className="word-editor-grab" />
            <p className="word-editor-kicker">Review this word</p>
            <h2 id="word-editor-title">{selectedWord.passage_word}</h2>
            <p className="word-editor-current">
              {selectedWord.heard_as
                ? "Heard: “" + selectedWord.heard_as + "”"
                : "Current mark: " + statusLabels[selectedWord.status]}
            </p>

            <div className="word-editor-actions">
              <button
                className="word-editor-row"
                data-editor-initial-focus
                onClick={() => applyOverride("correct", null, "marked as read correctly")}
                type="button"
              >
                Mark as read correctly
              </button>
              <button
                className="word-editor-row"
                onClick={() => applyOverride("skipped", null, "marked as skipped")}
                type="button"
              >
                Mark as skipped
              </button>
              <form className="heard-as-form" onSubmit={saveHeardAs}>
                <label htmlFor="heard-as">Heard as…</label>
                <div>
                  <input
                    id="heard-as"
                    onChange={(event) => setHeardAsDraft(event.target.value)}
                    placeholder="Type the word heard"
                    value={heardAsDraft}
                  />
                  <button type="submit">Save</button>
                </div>
              </form>
              <button className="word-editor-row cancel-row" onClick={closeEditor} type="button">
                Cancel
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {toastMessage ? (
        <div aria-live="polite" className="confirmation-toast" role="status">
          <CheckIcon />
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </main>
  );
}
