"use client";

import { useState } from "react";

import type { FocusRecommendation } from "@/lib/adaptive/selection";
import { readingSkillCatalog } from "@/lib/adaptive/skills-catalog";

type FocusPanelProps = {
  focus: FocusRecommendation;
  studentName: string;
};

type PanelAction = "choose" | "create" | "hold" | null;

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
export function FocusPanel({ focus, studentName }: FocusPanelProps) {
  const [action, setAction] = useState<PanelAction>(null);
  const skill = "skillId" in focus ? skillById.get(focus.skillId) : undefined;
  const evidence = focus.kind === "focused_card" ? focus.evidenceSummary : undefined;
  const stateLabel = focusStateLabel(focus);

  return (
    <section className="focus-panel" aria-labelledby="focus-panel-title">
      <div className="focus-panel-heading">
        <p className="focus-panel-kicker">Next practice</p>
        <h2 id="focus-panel-title">{panelHeading(focus, studentName)}</h2>
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
        <button className="primary-action focus-create-action" onClick={() => setAction("create")} type="button">
          Create card
        </button>
        <button className="secondary-action focus-secondary-action" onClick={() => setAction("choose")} type="button">
          Choose another focus
        </button>
        <button className="quiet-action focus-secondary-action" onClick={() => setAction("hold")} type="button">
          Not now
        </button>
      </div>

      {action === "create" ? (
        <p className="focus-panel-notice" role="status">
          This recommendation is ready for a curated practice card. Card creation is the next step.
        </p>
      ) : null}
      {action === "choose" ? (
        <p className="focus-panel-notice" role="status">
          You can choose a different focus before creating the card; Suno will keep this confirmed result intact.
        </p>
      ) : null}
      {action === "hold" ? (
        <p className="focus-panel-notice" role="status">
          No practice card will be created now. This never changes {studentName}&apos;s reading level.
        </p>
      ) : null}
    </section>
  );
}
