"use client";

import Link from "next/link";

import {
  adaptivePracticePath,
  focusedReadNowPath,
  type StoredAdaptiveWorksheet,
} from "@/lib/adaptive/card-view";

type AdaptiveCardPageProps = {
  card: StoredAdaptiveWorksheet;
  mode: "child" | "teacher";
  worksheetId: string;
};

function PrintIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 8V4.5h10V8M7 16H5.5A1.5 1.5 0 0 1 4 14.5v-5A1.5 1.5 0 0 1 5.5 8h13A1.5 1.5 0 0 1 20 9.5v5a1.5 1.5 0 0 1-1.5 1.5H17M7 13h10v6.5H7z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M17 11.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

function storyWord(value: string, index: number, card: StoredAdaptiveWorksheet, showTargets: boolean) {
  const target = card.tokens.find((token) => token.index === index && token.role === "target");

  return target && showTargets ? (
    <span className="adaptive-card-target" key={`${target.index}:${value}`}>
      {value}
    </span>
  ) : (
    value
  );
}

function StoryBody({ card, showTargets }: Pick<AdaptiveCardPageProps, "card"> & { showTargets: boolean }) {
  return (
    <p className="adaptive-card-story" lang="en">
      {card.content.body.split(/\s+/u).map((word, index) => (
        <span className="adaptive-card-word" key={`${index}:${word}`}>
          {storyWord(word, index, card, showTargets)}
          {index < card.content.body.split(/\s+/u).length - 1 ? " " : null}
        </span>
      ))}
    </p>
  );
}

/**
 * The same saved card has two deliberately separate surfaces. The teacher can
 * see quiet target marks while the child sees only the story, warm-up words,
 * and one question.
 */
export function AdaptiveCardPage({ card, mode, worksheetId }: AdaptiveCardPageProps) {
  const isChild = mode === "child";
  const readNowPath = focusedReadNowPath(card.studentId, card.adaptive.passageId);

  return (
    <main className={"adaptive-card-page" + (isChild ? " is-child-view" : " is-teacher-preview")}>
      <section className="adaptive-card-shell" aria-labelledby="adaptive-card-title">
        {isChild ? null : (
          <header className="adaptive-card-toolbar adaptive-card-screen-chrome">
            <Link className="worksheet-back-link" href="/">
              Back to class
            </Link>
            <div className="adaptive-card-actions">
              <Link className="secondary-action" href={adaptivePracticePath(worksheetId, "child")}>
                Child view
              </Link>
              <button className="primary-action" onClick={() => window.print()} type="button">
                <PrintIcon />
                Print
              </button>
              <Link className="primary-action adaptive-read-now" href={readNowPath}>
                Read now
              </Link>
            </div>
          </header>
        )}

        <article className="adaptive-card-sheet">
          {isChild ? null : (
            <header className="adaptive-card-preview-heading adaptive-card-screen-chrome">
              <p>Teacher preview</p>
              <span>Quiet underlines mark the words this card practises.</span>
            </header>
          )}

          <section className="adaptive-card-content">
            <p className="adaptive-card-kicker">Let&apos;s read</p>
            <h1 id="adaptive-card-title">{card.content.title}</h1>
            <div className="adaptive-card-warmup" aria-label="Warm-up words">
              {card.content.warmUpWords.map((word) => (
                <span key={word}>{word}</span>
              ))}
            </div>
            <StoryBody card={card} showTargets={!isChild} />
            <section className="adaptive-card-question" aria-label="Talk about the story">
              <p>Talk about it</p>
              <h2>{card.content.question}</h2>
            </section>
          </section>

          {isChild ? (
            <footer className="adaptive-card-child-action adaptive-card-screen-chrome">
              <Link className="primary-action" href={readNowPath}>
                I&apos;m ready to read
              </Link>
            </footer>
          ) : null}
        </article>
      </section>
    </main>
  );
}
