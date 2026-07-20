"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { MathItem } from "@/lib/adaptive/math/item-generator";

type MathCheckState = "ready" | "starting" | "checking" | "saving" | "complete" | "error";

type StartedCheck = {
  assessmentId: string;
  items: MathItem[];
  studentName: string;
};

function isStartedCheck(value: unknown): value is StartedCheck {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { assessmentId?: unknown }).assessmentId === "string" &&
    typeof (value as { studentName?: unknown }).studentName === "string" &&
    Array.isArray((value as { items?: unknown }).items)
  );
}

function problemLabel(item: MathItem) {
  return `${item.a} ${item.op} ${item.b}`;
}

export function MathCheckFlow({ studentId }: { studentId: string }) {
  const [state, setState] = useState<MathCheckState>("ready");
  const [check, setCheck] = useState<StartedCheck | null>(null);
  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState("");
  const [answers, setAnswers] = useState<Array<{ answer: number; itemId: string }>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const item = check?.items[index] ?? null;

  async function startCheck() {
    setState("starting");
    setNotice(null);
    try {
      const response = await fetch("/api/math/checks", {
        body: JSON.stringify({ studentId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isStartedCheck(payload)) {
        throw new Error(
          payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Couldn't start the math check.",
        );
      }
      startedAtRef.current = Date.now();
      setAnswers([]);
      setCheck(payload);
      setEntry("");
      setIndex(0);
      setState("checking");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't start the math check.");
      setState("error");
    }
  }

  function pressDigit(digit: number) {
    setEntry((current) => (current === "0" ? String(digit) : `${current}${digit}`).slice(0, 3));
    setNotice(null);
  }

  async function nextProblem() {
    if (!item || !check) {
      return;
    }
    if (entry.length === 0) {
      setNotice("Choose an answer before going on.");
      return;
    }

    const nextAnswers = [...answers, { answer: Number(entry), itemId: item.id }];
    if (index + 1 < check.items.length) {
      setAnswers(nextAnswers);
      setEntry("");
      setIndex((current) => current + 1);
      return;
    }

    setState("saving");
    setNotice(null);
    const elapsedSec = Math.max(0, Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1_000));
    try {
      const response = await fetch(`/api/math/checks/${check.assessmentId}`, {
        body: JSON.stringify({ answers: nextAnswers, elapsedSec, studentId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Couldn't save the math check.",
        );
      }
      setAnswers(nextAnswers);
      setState("complete");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn't save the math check.");
      setState("error");
    }
  }

  return (
    <main className="math-check-page">
      <section className="math-check-shell">
        {state === "ready" || state === "starting" || state === "error" ? (
          <section className="math-teacher-card">
            <p className="math-check-kicker">Numeracy</p>
            <h1>Run a 5-minute math check</h1>
            <p>Give the screen to the child. They will see one problem at a time and use the large number pad.</p>
            <button className="primary-action" disabled={state === "starting"} onClick={() => void startCheck()} type="button">
              {state === "starting" ? "Preparing…" : "Start math check"}
            </button>
            {notice ? <p className="math-check-notice" role="alert">{notice}</p> : null}
            <Link className="back-link" href="/">Back to class</Link>
          </section>
        ) : null}

        {state === "checking" && item && check ? (
          <section className="math-child-screen" aria-labelledby="math-problem-title">
            <p className="math-check-progress">Problem {index + 1} of {check.items.length}</p>
            <h1 id="math-problem-title" className="sr-only">Solve {problemLabel(item)}</h1>
            <div aria-label={problemLabel(item)} className="math-vertical-problem" role="img">
              <span>{item.a}</span>
              <span>{item.op} {item.b}</span>
              <i />
              <strong>{entry || "?"}</strong>
            </div>
            <div aria-label="Number pad" className="math-number-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button className="math-number-key" key={digit} onClick={() => pressDigit(digit)} type="button">
                  {digit}
                </button>
              ))}
              <button className="math-number-key math-number-key-muted" onClick={() => setEntry("")} type="button">Clear</button>
              <button className="math-number-key" onClick={() => pressDigit(0)} type="button">0</button>
              <button className="math-number-key math-number-key-muted" onClick={() => setEntry((current) => current.slice(0, -1))} type="button">⌫</button>
            </div>
            {notice ? <p className="math-check-notice" role="alert">{notice}</p> : null}
            <button className="primary-action math-next-action" onClick={() => void nextProblem()} type="button">
              {index + 1 === check.items.length ? "Finish" : "Next problem"}
            </button>
          </section>
        ) : null}

        {state === "saving" ? <p className="math-saving" role="status">Saving the check…</p> : null}

        {state === "complete" ? (
          <section className="math-complete-card" role="status">
            <p className="math-check-kicker">Well done</p>
            <h1>All finished.</h1>
            <p>The check is ready for the teacher to review. You did not show a score to the child.</p>
            {check ? (
              <Link className="primary-action" href={`/math/${studentId}/review/${check.assessmentId}`}>
                Review with teacher
              </Link>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
