"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  assessmentCaption,
  type DashboardStudent,
  type SuggestedGroup,
  type UnassessedStudent,
} from "@/lib/mock-dashboard";
import type { ReadingLevel } from "@/lib/mock-assessment";

type ClassroomDashboardProps = {
  confirmedStudent: DashboardStudent | null;
  groups: SuggestedGroup[];
  levelCounts: Record<ReadingLevel, number>;
  students: DashboardStudent[];
  unassessedStudents: UnassessedStudent[];
};

const levels: ReadingLevel[] = ["letter", "word", "paragraph", "story"];

const levelLabels: Record<ReadingLevel, string> = {
  letter: "Letter",
  word: "Word",
  paragraph: "Paragraph",
  story: "Story",
};

const trendLabels = {
  baseline: "No previous assessment",
  up: "Newly confirmed assessment",
} as const;

function childCountLabel(count: number) {
  return count + (count === 1 ? " child" : " children");
}

function LevelIcon({ level }: { level: ReadingLevel }) {
  if (level === "letter") {
    return <span className="dashboard-letter-icon">A</span>;
  }

  if (level === "story") {
    return (
      <svg fill="none" viewBox="0 0 24 24">
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
    <svg fill="none" viewBox="0 0 24 24">
      {level === "word" ? (
        <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      ) : (
        <>
          <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

function AssessIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect height="11" rx="3.5" stroke="currentColor" strokeWidth="1.9" width="7" x="8.5" y="2" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function TrendIcon({ trend }: { trend: DashboardStudent["trend"] }) {
  if (trend === "up") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="m5 15 6-6 3.5 3.5L19 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
        <path d="M14.5 8H19v4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m5 12.5 4.3 4.3L19 7.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function StudentCard({ student }: { student: DashboardStudent }) {
  return (
    <article className={"student-card" + (student.isNewlyConfirmed ? " is-slotting-in" : "")}>
      <div className="student-card-copy">
        <h3 title={student.name}>{student.name}</h3>
        <p>
          <span className="assessment-caption" title={assessmentCaption(student)}>
            {assessmentCaption(student)}
          </span>
          <span className={"student-trend trend-" + student.trend}>
            <TrendIcon trend={student.trend} />
            <span className="sr-only">{trendLabels[student.trend]}</span>
          </span>
        </p>
      </div>
      <Link
        aria-label={"Assess " + student.name}
        className="student-assess-button"
        href={"/assess/" + student.id}
      >
        <AssessIcon />
      </Link>
    </article>
  );
}

function UnassessedStudentCard({ student }: { student: UnassessedStudent }) {
  return (
    <article className="student-card unassessed-student-card">
      <div className="student-card-copy">
        <h3 title={student.name}>{student.name}</h3>
        <p>Not assessed yet</p>
      </div>
      <Link
        aria-label={"Assess now: " + student.name}
        className="unassessed-assess-button"
        href={"/assess/" + student.id}
      >
        Assess now
      </Link>
    </article>
  );
}

export function ClassroomDashboard({
  confirmedStudent,
  groups,
  levelCounts,
  students,
  unassessedStudents,
}: ClassroomDashboardProps) {
  const [showToast, setShowToast] = useState(confirmedStudent !== null);
  const totalChildren = students.length + unassessedStudents.length;

  useEffect(() => {
    if (!confirmedStudent) {
      return undefined;
    }

    const dismissToast = window.setTimeout(() => setShowToast(false), 3_000);
    return () => window.clearTimeout(dismissToast);
  }, [confirmedStudent]);

  if (totalChildren === 0) {
    return (
      <main className="dashboard-page">
        <section className="empty-class-invitation">
          <p className="dashboard-wordmark">Suno</p>
          <h1>Listen to your first reader</h1>
          <p>Start with one child. Suno will help you see the class take shape.</p>
          <Link className="primary-action" href="/assess/mock-reader">
            Assess a child
          </Link>
        </section>
      </main>
    );
  }

  const firstStudent = unassessedStudents[0] ?? students[0];

  return (
    <main className="dashboard-page">
      <section className="dashboard-shell" aria-labelledby="dashboard-title">
        <header className="dashboard-header">
          <div className="dashboard-heading">
            <p className="dashboard-wordmark">Suno</p>
            <h1 id="dashboard-title">
              Class 3 <span>· {childCountLabel(totalChildren)}</span>
            </h1>
          </div>
          {firstStudent ? (
            <Link className="primary-action dashboard-assess-action" href={"/assess/" + firstStudent.id}>
              Assess a child
            </Link>
          ) : null}
        </header>

        <nav aria-label="Reading levels" className="level-ladder">
          {levels.map((level) => (
            <a
              aria-label={levelLabels[level] + " — " + childCountLabel(levelCounts[level])}
              className={"ladder-chip level-" + level}
              href={"#level-" + level}
              key={level}
            >
              <span aria-hidden="true" className="ladder-icon">
                <LevelIcon level={level} />
              </span>
              <span className="ladder-label">{levelLabels[level]}</span>
              <strong>{levelCounts[level]}</strong>
            </a>
          ))}
        </nav>

        {unassessedStudents.length > 0 ? (
          <section className="unassessed-section" aria-labelledby="unassessed-title">
            <div>
              <p>Not yet assessed</p>
              <h2 id="unassessed-title">{childCountLabel(unassessedStudents.length)}</h2>
            </div>
            <div className="unassessed-grid">
              {unassessedStudents.map((student) => (
                <UnassessedStudentCard key={student.id} student={student} />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="Reading-level heatmap" className="reading-level-columns">
          {levels.map((level) => {
            const levelStudents = students.filter((student) => student.level === level);
            const isConfirmedLevel = confirmedStudent?.level === level;

            return (
              <section
                className={
                  "level-column level-" +
                  level +
                  (isConfirmedLevel ? " is-confirmed-level" : "")
                }
                id={"level-" + level}
                key={level}
                aria-labelledby={"level-heading-" + level}
              >
                <header className="level-column-header">
                  <span aria-hidden="true" className="level-column-icon">
                    <LevelIcon level={level} />
                  </span>
                  <div>
                    <h2 id={"level-heading-" + level}>{levelLabels[level]}</h2>
                    <p>{childCountLabel(levelStudents.length)}</p>
                  </div>
                </header>
                <ul className="level-student-grid">
                  {levelStudents.length > 0 ? (
                    levelStudents.map((student) => (
                      <li key={student.id}>
                        <StudentCard student={student} />
                      </li>
                    ))
                  ) : (
                    <li className="empty-level-card">No children at this level yet.</li>
                  )}
                </ul>
              </section>
            );
          })}
        </section>

        <section className="suggested-groups" aria-labelledby="groups-title">
          <div className="groups-heading">
            <p>Teaching at the Right Level</p>
            <h2 id="groups-title">Suggested groups</h2>
          </div>
          <ul className="groups-grid">
            {groups.map((group) => (
              <li className={"group-card level-" + group.level} key={group.level}>
                <div>
                  <p>Group {group.number}</p>
                  <h3>{levelLabels[group.level]} level</h3>
                  <span>{childCountLabel(group.childCount)}</span>
                </div>
                <button className="group-print-button" disabled type="button">
                  Print reading cards
                </button>
              </li>
            ))}
          </ul>
        </section>

        {confirmedStudent ? (
          <p className="sr-only" role="status">
            {confirmedStudent.name} added to {levelLabels[confirmedStudent.level]} level.
          </p>
        ) : null}
      </section>

      {showToast && confirmedStudent ? (
        <div aria-live="polite" className="dashboard-toast" role="status">
          <CheckIcon />
          <span>
            {confirmedStudent.name} confirmed at {levelLabels[confirmedStudent.level].toLowerCase()} level
          </span>
        </div>
      ) : null}
    </main>
  );
}
