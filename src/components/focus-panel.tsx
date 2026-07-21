"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { adaptivePracticePath } from "@/lib/adaptive/card-view";
import { InfoSheet } from "@/components/info-sheet";
import type { FocusRecommendation } from "@/lib/adaptive/selection";
import { readingSkillCatalog } from "@/lib/adaptive/skills-catalog";
import type { AssessmentPassage } from "@/lib/assessment-types";

type FocusPanelProps = {
  focus: FocusRecommendation;
  passage: Pick<AssessmentPassage, "language" | "level">;
  studentId: string;
  studentName: string;
};

type PanelAction = "choose" | "hold" | null;

const skillById = new Map(readingSkillCatalog.map((skill) => [skill.id, skill]));

function pluralize(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

function focusStateLabel(focus: FocusRecommendation) {
  if (focus.kind !== "focused_card") {
    return null;
  }

  if (focus.source === "new_skill") {
    return "growing";
  }

  if (focus.source === "review_due") {
    return "ready to review";
  }

  return "practising";
}

function panelHeading(focus: FocusRecommendation, studentName: string) {
  if (focus.kind === "teacher_strategy_needed") {
    return `What could help ${studentName} next?`;
  }

  return `What should ${studentName} practise next?`;
}

/**
 * Teacher-only follow-up panel. It intentionally avoids level colors and
 * child-facing error language; the recommendation comes only from confirmed
 * evidence already persisted by the confirmation route.
 */
export function FocusPanel({ focus, passage, studentId, studentName }: FocusPanelProps) {
  const router = useRouter();
  const [action, setAction] = useState<PanelAction>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const skill = "skillId" in focus ? skillById.get(focus.skillId) : undefined;
  const evidence = focus.kind === "focused_card" ? focus.evidenceSummary : undefined;
  const stateLabel = focusStateLabel(focus);
  const availableSkills = readingSkillCatalog.filter(
    (candidate) =>
      candidate.language === passage.language && candidate.aserBands.includes(passage.level),
  );
  const [chosenSkillId, setChosenSkillId] = useState<string | null>(
    focus.kind === "focused_card" ? focus.skillId : null,
  );

  async function createCard() {
    const focusSkillId = chosenSkillId ?? (focus.kind === "focused_card" ? focus.skillId : undefined);

    if (!focusSkillId) {
      setAction("choose");
      return;
    }

    setCreateError(null);
    setIsCreating(true);

    try {
      const response = await fetch("/api/worksheets", {
        body: JSON.stringify({
          adaptive: { focusSkillId, studentId },
          language: passage.language,
          level: passage.level,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json().catch(() => null);

      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        typeof (payload as { worksheetId?: unknown }).worksheetId !== "string"
      ) {
        const message =
          payload &&
          typeof payload === "object" &&
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Could not create this practice card. Try again.";
        throw new Error(message);
      }

      router.push(adaptivePracticePath((payload as { worksheetId: string }).worksheetId));
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Could not create this practice card. Try again.",
      );
      setIsCreating(false);
    }
  }

  return (
    <section className="focus-panel" aria-labelledby="focus-panel-title">
      <div className="focus-panel-heading">
        <p className="focus-panel-kicker">Next practice</p>
        <h2 id="focus-panel-title">{panelHeading(focus, studentName)} <InfoSheet body="The next practice suggestion comes from teacher-confirmed reading evidence, not an AI guess alone. You can choose another focus or decide not to create a card." href="/why#loop" label="About next practice" title="How focus suggestions work" /></h2>
      </div>

      {skill ? (
        <div className="focus-chip-row">
          <span className="focus-skill-chip">{skill.displayName}</span>
          {stateLabel ? <span className="focus-state-chip">{stateLabel}</span> : null}
        </div>
      ) : null}

      <blockquote className="focus-reason">
        &ldquo;{focus.reason}&rdquo;
      </blockquote>

      {evidence ? (
        <ul aria-label="Confirmed evidence" className="focus-evidence-chips">
          <li>
            {evidence.errors} {pluralize(evidence.errors, "substitution", "substitutions")}
          </li>
          <li>
            {evidence.hesitations} {pluralize(evidence.hesitations, "hesitation", "hesitations")}
          </li>
          <li>
            {evidence.opportunities} {pluralize(evidence.opportunities, "chance", "chances")}
          </li>
        </ul>
      ) : null}

      {focus.kind === "teacher_strategy_needed" ? (
        <ul aria-label="Suggested alternatives" className="focus-alternatives">
          {focus.alternatives.map((alternative) => (
            <li key={alternative}>{alternative}</li>
          ))}
        </ul>
      ) : null}

      <div className="focus-panel-actions">
        <button
          aria-busy={isCreating}
          className="primary-action focus-create-action"
          disabled={isCreating}
          onClick={() => void createCard()}
          type="button"
        >
          {isCreating ? "Creating card…" : "Create card"}
        </button>
        <button className="secondary-action focus-secondary-action" onClick={() => setAction("choose")} type="button">
          Choose another focus
        </button>
        <button className="quiet-action focus-secondary-action" onClick={() => setAction("hold")} type="button">
          Not now
        </button>
      </div>

      {action === "choose" ? (
        <div className="focus-panel-choice">
          <label htmlFor="focus-skill-select">Choose the practice focus</label>
          <select
            id="focus-skill-select"
            onChange={(event) => setChosenSkillId(event.target.value || null)}
            value={chosenSkillId ?? ""}
          >
            <option value="">Choose a focus</option>
            {availableSkills.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName}
              </option>
            ))}
          </select>
          <p>The child&apos;s confirmed level stays unchanged.</p>
        </div>
      ) : null}
      {action === "hold" ? (
        <p className="focus-panel-notice" role="status">
          No practice card will be created now. This never changes {studentName}&apos;s reading level.
        </p>
      ) : null}
      {createError ? (
        <p className="focus-panel-error" role="alert">
          {createError}
        </p>
      ) : null}
    </section>
  );
}
