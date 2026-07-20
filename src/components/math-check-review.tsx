"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { bugCatalog, mathBugIds, type BugId } from "@/lib/adaptive/math/bug-catalog";
import type { MathCheckDraft } from "@/lib/adaptive/math/check-contract";
import {
  matchingMathBugIds,
  mathBugWorkedFingerprint,
  type MathDiagnosis,
  type MathReviewTag,
} from "@/lib/adaptive/math/diagnosis";

type MathCheckReviewProps = {
  assessmentId: string;
  check: MathCheckDraft;
  studentId: string;
  studentName: string;
};

function displayProblem(a: number, op: string, b: number) {
  return `${a} ${op} ${b}`;
}

function isReviewTag(value: string): value is MathReviewTag {
  return value === "slip" || value === "dismiss" || mathBugIds.includes(value as BugId);
}

export function MathCheckReview({
  assessmentId,
  check,
  studentId,
  studentName,
}: MathCheckReviewProps) {
  const [tags, setTags] = useState<Record<string, MathReviewTag | undefined>>({});
  const [isConfirming, setIsConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<MathDiagnosis | null>(null);
  const answerByItemId = useMemo(
    () => new Map(check.answers.map((answer) => [answer.itemId, answer.answer])),
    [check.answers],
  );

  async function confirmReview() {
    setIsConfirming(true);
    setNotice(null);
    try {
      const reviews = Object.entries(tags)
        .filter((entry): entry is [string, MathReviewTag] => entry[1] !== undefined)
        .map(([itemId, reviewTag]) => ({ itemId, reviewTag }));
      const response = await fetch(`/api/math/checks/${assessmentId}/confirm`, {
        body: JSON.stringify({ reviews, studentId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("diagnosis" in payload) ||
        typeof (payload as { diagnosis?: unknown }).diagnosis !== "object"
      ) {
        throw new Error(
          payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Couldn't confirm the math check.",
        );
      }
      setDiagnosis((payload as { diagnosis: MathDiagnosis }).diagnosis);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't confirm the math check.");
    } finally {
      setIsConfirming(false);
    }
  }

  if (diagnosis) {
    return (
      <main className="math-review-page">
        <section className="math-review-result" role="status">
          <p className="math-check-kicker">Math check confirmed</p>
          <h1>{diagnosis.recommendation ? "A practice focus is ready" : "No repeated pattern confirmed"}</h1>
          <p>
            {diagnosis.recommendation?.reason ??
              `${studentName}'s answers are saved. Keep practising broadly and check again later.`}
          </p>
          {diagnosis.recommendation ? (
            <Link className="primary-action" href={`/math/${studentId}/practice/${assessmentId}`}>
              Create practice sheet
            </Link>
          ) : <Link className="primary-action" href="/">Back to class</Link>}
        </section>
      </main>
    );
  }

  return (
    <main className="math-review-page">
      <section className="math-review-shell">
        <header className="math-review-heading">
          <p className="math-check-kicker">Teacher review · Numeracy</p>
          <h1>{studentName}&apos;s math check</h1>
          <p>Review the answers before saving a practice focus. Untouched matches stay at the lower automatic reliability.</p>
        </header>

        <ol className="math-review-list">
          {check.items.map((item, index) => {
            const answer = answerByItemId.get(item.id);
            const isCorrect = answer === item.answer;
            const matches = answer === undefined ? [] : matchingMathBugIds(item, answer);
            const compatibleBugs = mathBugIds.filter((bugId) => bugCatalog[bugId].operation === item.op);
            const tag = tags[item.id];

            return (
              <li className={isCorrect ? "math-review-item is-correct" : "math-review-item is-wrong"} key={item.id}>
                <div className="math-review-problem">
                  <span>#{index + 1}</span>
                  <strong>{displayProblem(item.a, item.op, item.b)} = {answer ?? "—"}</strong>
                  <small>Correct answer: {item.answer}</small>
                </div>
                {!isCorrect ? (
                  <div className="math-review-controls">
                    {matches.length > 0 ? (
                      <p>
                        Auto match: {matches.map((bugId) => bugCatalog[bugId].displayName).join(" · ")}
                        <span>{mathBugWorkedFingerprint(matches[0]!)}</span>
                      </p>
                    ) : (
                      <p>Auto match: no named pattern</p>
                    )}
                    <label>
                      Teacher tag
                      <select
                        onChange={(event) => {
                          const value = event.target.value;
                          setTags((current) => ({
                            ...current,
                            [item.id]: value === "" ? undefined : isReviewTag(value) ? value : undefined,
                          }));
                        }}
                        value={tag ?? ""}
                      >
                        <option value="">Keep auto match</option>
                        <option value="slip">Slip — no bug evidence</option>
                        <option value="dismiss">Dismiss this answer</option>
                        {compatibleBugs.map((bugId) => (
                          <option key={bugId} value={bugId}>Tag: {bugCatalog[bugId].displayName}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : <span className="math-review-correct">Correct</span>}
              </li>
            );
          })}
        </ol>

        {notice ? <p className="math-check-notice" role="alert">{notice}</p> : null}
        <button className="primary-action math-confirm-action" disabled={isConfirming} onClick={() => void confirmReview()} type="button">
          {isConfirming ? "Confirming…" : "Confirm math evidence"}
        </button>
      </section>
    </main>
  );
}
