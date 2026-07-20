"use client";

import Link from "next/link";

import type { MathItem } from "@/lib/adaptive/math/item-generator";
import type { StoredMathFocus } from "@/lib/adaptive/math/focus";

type MathPracticeSheetProps = {
  assessmentId: string;
  focus: StoredMathFocus;
  items: MathItem[];
  studentId: string;
  studentName: string;
};

function problem(item: MathItem) {
  return `${item.a} ${item.op} ${item.b} =`;
}

export function MathPracticeSheet({
  assessmentId,
  focus,
  items,
  studentId,
  studentName,
}: MathPracticeSheetProps) {
  return (
    <main className="math-practice-page">
      <section className="math-practice-sheet">
        <header className="math-practice-heading">
          <div>
            <p className="math-check-kicker">Numeracy practice</p>
            <h1>Practise together, {studentName}</h1>
            <p>{focus.reason}</p>
          </div>
          <div className="math-practice-screen-chrome">
            <button className="secondary-action" onClick={() => window.print()} type="button">Print sheet</button>
            <Link className="primary-action" href={`/math/${studentId}/recheck/${assessmentId}`}>Run re-check</Link>
          </div>
        </header>

        <ol className="math-practice-problems">
          {items.map((item, index) => <li key={item.id}>{index + 1}. {problem(item)}</li>)}
        </ol>
        <p className="math-practice-celebration">Take it slowly. Every try helps your brain grow.</p>
      </section>

      <section className="math-answer-key">
        <h2>Teacher answer key</h2>
        <ol>
          {items.map((item, index) => <li key={item.id}>{index + 1}. {item.a} {item.op} {item.b} = {item.answer}</li>)}
        </ol>
      </section>
    </main>
  );
}
