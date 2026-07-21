"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TeacherAccountMenu } from "@/components/teacher-account-menu";
import { adaptivePracticePath } from "@/lib/adaptive/card-view";
import type { GroupRecommendation } from "@/lib/adaptive/grouping";
import {
  assessmentCaption,
  type ArchivedStudent,
  type DashboardStudent,
  type SuggestedGroup,
  type UnassessedStudent,
} from "@/lib/mock-dashboard";
import { worksheetPath } from "@/lib/worksheet-route";
import type { ReadingLevel } from "@/lib/mock-assessment";

type ClassroomDashboardProps = {
  archivedStudents: ArchivedStudent[];
  confirmedStudent: DashboardStudent | null;
  groupRecommendations: Partial<Record<ReadingLevel, GroupRecommendation>>;
  groups: SuggestedGroup[];
  isDemoClassroom: boolean;
  levelCounts: Record<ReadingLevel, number>;
  movementCount: number;
  students: DashboardStudent[];
  unassessedStudents: UnassessedStudent[];
};

type RosterActionStudent = {
  id: string;
  isTeacherPlaced?: boolean;
  name: string;
};

type EditorState = {
  grade: string;
  mode: "add" | "edit";
  name: string;
  startingLevel: "" | ReadingLevel;
  studentId: string | null;
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

function cleanName(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function hasValidName(value: string) {
  return /^[\p{L}\p{M}][\p{L}\p{M}\p{Zs}.'’-]*$/u.test(value) && value.length <= 40;
}

function newChildEditor(): EditorState {
  return { grade: "", mode: "add", name: "", startingLevel: "", studentId: null };
}

function editChildEditor(student: RosterActionStudent): EditorState {
  return {
    grade: "",
    mode: "edit",
    name: student.name,
    // A blank selection makes rename-only edits evidence-neutral. Selecting a
    // level intentionally invokes the P3-T6 provisional-placement API.
    startingLevel: "",
    studentId: student.id,
  };
}

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return payload && typeof payload.error === "string" ? payload.error : fallback;
}

function GroupActionCard({
  level,
  recommendation,
  studentIds,
}: {
  level: ReadingLevel;
  recommendation: GroupRecommendation;
  studentIds: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function createFocusedCard() {
    if (recommendation.kind !== "focused_card") return;

    setError(null);
    setIsCreating(true);
    try {
      const response = await fetch("/api/worksheets", {
        body: JSON.stringify({
          adaptive: { focusSkillId: recommendation.skillId, groupStudentIds: studentIds },
          language: "en",
          level,
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
            : "Could not create this group card. Try again.";
        throw new Error(message);
      }

      router.push(adaptivePracticePath((payload as { worksheetId: string }).worksheetId));
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Could not create this group card.");
      setIsCreating(false);
    }
  }

  return (
    <aside className="group-action-card">
      {recommendation.kind === "focused_card" ? (
        <>
          <p>Common practice</p>
          <h3>{recommendation.reason}</h3>
          <span>
            {recommendation.affectedStudents} of {studentIds.length} children · {recommendation.reviewDueStudents} ready to review
          </span>
          <button disabled={isCreating} onClick={() => void createFocusedCard()} type="button">
            {isCreating ? "Creating…" : "Create group card"}
          </button>
        </>
      ) : (
        <>
          <p>Group practice</p>
          <h3>{recommendation.reason}</h3>
          <span>{recommendation.reviewDueStudents} ready to review</span>
          <Link href={worksheetPath(level)}>Create general card</Link>
        </>
      )}
      {error ? <span className="group-action-error" role="alert">{error}</span> : null}
    </aside>
  );
}

function LevelIcon({ level }: { level: ReadingLevel }) {
  if (level === "letter") return <span className="dashboard-letter-icon">A</span>;

  if (level === "story") {
    return (
      <svg fill="none" viewBox="0 0 24 24">
        <path
          d="M4.5 5.5c3.2-1.1 5.7-.5 7.5 1.5 1.8-2 4.3-2.6 7.5-1.5v12c-3.2-1.1-5.7-.5-7.5 1.5zM12 7v12"
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

function StudentOverflowMenu({
  isOpen,
  onArchive,
  onEdit,
  onToggle,
  studentName,
}: {
  isOpen: boolean;
  onArchive: () => void;
  onEdit: () => void;
  onToggle: () => void;
  studentName: string;
}) {
  return (
    <div className="student-overflow-menu">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`More actions for ${studentName}`}
        className="student-overflow-trigger"
        onClick={onToggle}
        type="button"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {isOpen ? (
        <div aria-label={`Actions for ${studentName}`} className="student-overflow-popover" role="menu">
          <button onClick={onEdit} role="menuitem" type="button">Edit child</button>
          <button className="archive-menu-action" onClick={onArchive} role="menuitem" type="button">Archive</button>
        </div>
      ) : null}
    </div>
  );
}

function StudentCard({
  onArchive,
  onEdit,
  onMenuToggle,
  openMenuId,
  student,
}: {
  onArchive: (student: RosterActionStudent) => void;
  onEdit: (student: RosterActionStudent) => void;
  onMenuToggle: (studentId: string) => void;
  openMenuId: string | null;
  student: DashboardStudent;
}) {
  return (
    <article className={"student-card" + (student.isNewlyConfirmed ? " is-slotting-in" : "")}>
      <div className="student-card-copy">
        <div className="student-card-name-row">
          <h3 title={student.name}><Link href={`/student/${student.id}`}>{student.name}</Link></h3>
          {student.isTeacherPlaced ? <span className="teacher-placed-chip">Teacher placed</span> : null}
        </div>
        <p>
          <span className="assessment-caption" title={assessmentCaption(student)}>{assessmentCaption(student)}</span>
          <span className={"student-trend trend-" + student.trend}>
            <TrendIcon trend={student.trend} />
            <span className="sr-only">{trendLabels[student.trend]}</span>
          </span>
        </p>
      </div>
      <Link aria-label={`Assess ${student.name}`} className="student-assess-button" href={`/assess/${student.id}`}>
        <AssessIcon />
      </Link>
      <Link aria-label={`Run a math check for ${student.name}`} className="student-numeracy-link" href={`/math/${student.id}`}>
        Math
      </Link>
      <StudentOverflowMenu
        isOpen={openMenuId === student.id}
        onArchive={() => onArchive(student)}
        onEdit={() => onEdit(student)}
        onToggle={() => onMenuToggle(student.id)}
        studentName={student.name}
      />
    </article>
  );
}

function UnassessedStudentCard({
  onArchive,
  onEdit,
  onMenuToggle,
  openMenuId,
  student,
}: {
  onArchive: (student: RosterActionStudent) => void;
  onEdit: (student: RosterActionStudent) => void;
  onMenuToggle: (studentId: string) => void;
  openMenuId: string | null;
  student: UnassessedStudent;
}) {
  return (
    <article className="student-card unassessed-student-card">
      <div className="student-card-copy">
        <h3 title={student.name}><Link href={`/student/${student.id}`}>{student.name}</Link></h3>
        <p>Not assessed yet</p>
      </div>
      <Link aria-label={`Assess now: ${student.name}`} className="unassessed-assess-button" href={`/assess/${student.id}`}>
        Assess now
      </Link>
      <span aria-hidden="true" className="student-card-spacer" />
      <StudentOverflowMenu
        isOpen={openMenuId === student.id}
        onArchive={() => onArchive(student)}
        onEdit={() => onEdit(student)}
        onToggle={() => onMenuToggle(student.id)}
        studentName={student.name}
      />
    </article>
  );
}

export function ClassroomDashboard({
  archivedStudents,
  confirmedStudent,
  groupRecommendations,
  groups,
  isDemoClassroom,
  levelCounts,
  movementCount,
  students,
  unassessedStudents,
}: ClassroomDashboardProps) {
  const router = useRouter();
  const [archiveTarget, setArchiveTarget] = useState<RosterActionStudent | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showToast, setShowToast] = useState(confirmedStudent !== null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmedStudent) return undefined;
    const dismissToast = window.setTimeout(() => setShowToast(false), 3_000);
    return () => window.clearTimeout(dismissToast);
  }, [confirmedStudent]);

  const knownNames = useMemo(
    () => [...students, ...unassessedStudents].map((student) => ({ id: student.id, name: student.name })),
    [students, unassessedStudents],
  );
  const totalChildren = students.length + unassessedStudents.length;
  const cleanEditorName = editor ? cleanName(editor.name) : "";
  const nameIsValid = editor ? hasValidName(cleanEditorName) : false;
  const duplicateName = Boolean(
    editor &&
      cleanEditorName &&
      knownNames.some(
        (student) =>
          student.id !== editor.studentId && student.name.localeCompare(cleanEditorName, undefined, { sensitivity: "accent" }) === 0,
      ),
  );

  function openAddChild() {
    setError(null);
    setEditor(newChildEditor());
  }

  function openEditChild(student: RosterActionStudent) {
    setError(null);
    setOpenMenuId(null);
    setEditor(editChildEditor(student));
  }

  function openArchiveChild(student: RosterActionStudent) {
    setError(null);
    setOpenMenuId(null);
    setArchiveTarget(student);
  }

  async function saveStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !nameIsValid) {
      setError("Enter a child’s name using 1–40 Latin or Devanagari letters.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const isAdd = editor.mode === "add";
      const response = await fetch(isAdd ? "/api/students" : `/api/students/${editor.studentId}`, {
        body: JSON.stringify(
          isAdd
            ? {
                grade: editor.grade.trim() || null,
                name: cleanEditorName,
                startingLevel: editor.startingLevel || null,
              }
            : {
                name: cleanEditorName,
                ...(editor.startingLevel ? { startingLevel: editor.startingLevel } : {}),
              },
        ),
        headers: { "content-type": "application/json" },
        method: isAdd ? "POST" : "PATCH",
      });

      if (!response.ok) throw new Error(await readApiError(response, "Couldn't save the child. Try again."));

      setEditor(null);
      setStatusMessage(isAdd ? `${cleanEditorName} is now in the class.` : `${cleanEditorName} was updated.`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save the child. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function setArchived(student: RosterActionStudent, isArchived: boolean) {
    setError(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/students/${student.id}`, {
        body: JSON.stringify({ isArchived }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) throw new Error(await readApiError(response, "Couldn't update this child. Try again."));

      setArchiveTarget(null);
      setStatusMessage(isArchived ? `${student.name} was archived.` : `${student.name} was restored to the class.`);
      router.refresh();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Couldn't update this child. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const dashboardContent = totalChildren === 0 ? (
    <main className="dashboard-page">
      <section className="empty-class-invitation">
        <p className="dashboard-wordmark">Suno</p>
        <h1>Listen to your first reader</h1>
        <p>Start with one child. Suno will help you see the class take shape.</p>
        <button className="primary-action empty-class-add-action" onClick={openAddChild} type="button">Add your first child</button>
      </section>
    </main>
  ) : (
    <main className="dashboard-page">
      <section className="dashboard-shell" aria-labelledby="dashboard-title">
        <header className="dashboard-header">
          <div className="dashboard-heading">
            <p className="dashboard-wordmark">Suno</p>
            <h1 id="dashboard-title">Class 3 <span>· {childCountLabel(totalChildren)}</span></h1>
          </div>
          <div className="dashboard-header-actions">
            <button className="dashboard-add-action" onClick={openAddChild} type="button">+ Add child</button>
            <Link className="primary-action dashboard-assess-action" href={`/assess/${(unassessedStudents[0] ?? students[0]).id}`}>
              Assess a child
            </Link>
            <TeacherAccountMenu />
          </div>
        </header>

        <nav aria-label="Reading levels" className="level-ladder">
          {levels.map((level) => (
            <a aria-label={`${levelLabels[level]} — ${childCountLabel(levelCounts[level])}`} className={`ladder-chip level-${level}`} href={`#level-${level}`} key={level}>
              <span aria-hidden="true" className="ladder-icon"><LevelIcon level={level} /></span>
              <span className="ladder-label">{levelLabels[level]}</span>
              <strong>{levelCounts[level]}</strong>
            </a>
          ))}
        </nav>

        {statusMessage ? <p className="roster-status" role="status">{statusMessage}</p> : null}
        {movementCount > 0 ? <p className="class-movement-banner">{movementCount} {movementCount === 1 ? "child has" : "children have"} moved up in the recorded reading history.</p> : null}

        {unassessedStudents.length > 0 ? (
          <section className="unassessed-section" aria-labelledby="unassessed-title">
            <div>
              <p>Not yet assessed</p>
              <h2 id="unassessed-title">{childCountLabel(unassessedStudents.length)}</h2>
            </div>
            <div className="unassessed-grid">
              {unassessedStudents.map((student) => (
                <UnassessedStudentCard key={student.id} onArchive={openArchiveChild} onEdit={openEditChild} onMenuToggle={(id) => setOpenMenuId(openMenuId === id ? null : id)} openMenuId={openMenuId} student={student} />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="Reading-level heatmap" className="reading-level-columns">
          {levels.map((level) => {
            const levelStudents = students.filter((student) => student.level === level);
            const groupRecommendation = groupRecommendations[level];
            const isConfirmedLevel = confirmedStudent?.level === level;
            return (
              <section aria-labelledby={`level-heading-${level}`} className={`level-column level-${level}${isConfirmedLevel ? " is-confirmed-level" : ""}`} id={`level-${level}`} key={level}>
                <header className="level-column-header">
                  <span aria-hidden="true" className="level-column-icon"><LevelIcon level={level} /></span>
                  <div><h2 id={`level-heading-${level}`}>{levelLabels[level]}</h2><p>{childCountLabel(levelStudents.length)}</p></div>
                </header>
                {groupRecommendation?.kind === "focused_card" ? <p className="column-attention-chip">Practice focus: {groupRecommendation.reason}</p> : null}
                <ul className="level-student-grid">
                  {levelStudents.length > 0 ? levelStudents.map((student) => (
                    <li key={student.id}><StudentCard onArchive={openArchiveChild} onEdit={openEditChild} onMenuToggle={(id) => setOpenMenuId(openMenuId === id ? null : id)} openMenuId={openMenuId} student={student} /></li>
                  )) : <li className="empty-level-card">No children at this level yet.</li>}
                </ul>
                {groupRecommendation ? <GroupActionCard level={level} recommendation={groupRecommendation} studentIds={levelStudents.map((student) => student.id)} /> : null}
              </section>
            );
          })}
        </section>

        <section className="suggested-groups" aria-labelledby="groups-title">
          <div className="groups-heading"><p>Teaching at the Right Level</p><h2 id="groups-title">Suggested groups</h2></div>
          <ul className="groups-grid">
            {groups.map((group) => (
              <li className={`group-card level-${group.level}`} key={group.level}>
                <div><p>Group {group.number}</p><h3>{levelLabels[group.level]} level</h3><span>{childCountLabel(group.childCount)}</span></div>
                <Link className="group-print-button" href={worksheetPath(group.level)}>Print reading cards</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="archived-students-section">
          <button aria-controls="archived-students" aria-expanded={showArchived} className="archived-students-toggle" onClick={() => setShowArchived(!showArchived)} type="button">
            Archived ({archivedStudents.length})
          </button>
          {showArchived ? (
            <div className="archived-students-panel" id="archived-students">
              {archivedStudents.length === 0 ? <p>No archived children.</p> : (
                <ul>{archivedStudents.map((student) => <li key={student.id}><span>{student.name}</span><button disabled={isSaving} onClick={() => void setArchived(student, false)} type="button">Restore</button></li>)}</ul>
              )}
            </div>
          ) : null}
        </section>

        {confirmedStudent ? <p className="sr-only" role="status">{confirmedStudent.name} added to {levelLabels[confirmedStudent.level]} level.</p> : null}
      </section>
      {showToast && confirmedStudent ? <div aria-live="polite" className="dashboard-toast" role="status"><CheckIcon /><span>{confirmedStudent.name} confirmed at {levelLabels[confirmedStudent.level].toLowerCase()} level</span></div> : null}
    </main>
  );

  return (
    <>
      {dashboardContent}
      {editor ? (
        <div aria-modal="true" className="roster-dialog-backdrop" role="dialog" aria-labelledby="student-editor-title">
          <form className="roster-dialog" onSubmit={saveStudent}>
            <div className="roster-dialog-heading"><div><p>{editor.mode === "add" ? "New child" : "Edit child"}</p><h2 id="student-editor-title">{editor.mode === "add" ? "Add a child" : "Update this child"}</h2></div><button aria-label="Close" className="dialog-close" disabled={isSaving} onClick={() => setEditor(null)} type="button">×</button></div>
            <label>Name<input autoFocus maxLength={40} onChange={(event) => setEditor({ ...editor, name: event.target.value })} placeholder="e.g. Meera" value={editor.name} /></label>
            {!nameIsValid && editor.name.length > 0 ? <p className="field-error">Use 1–40 letters in English or Hindi. Emoji are not supported.</p> : null}
            {duplicateName ? <p className="duplicate-name-warning">Another {cleanEditorName} is in this class — add a surname initial?</p> : null}
            {editor.mode === "add" ? <label>Grade <span>Optional</span><input maxLength={20} onChange={(event) => setEditor({ ...editor, grade: event.target.value })} placeholder="e.g. 3" value={editor.grade} /></label> : null}
            <fieldset className="placement-picker"><legend>{editor.mode === "add" ? "Starting level" : "Set a teacher placement"}</legend><p>{editor.mode === "add" ? "A starting level is your estimate. The first confirmed reading check replaces it." : "Only choose a level to make a manual, provisional placement."}</p><div>{([{ label: editor.mode === "add" ? "Not assessed yet" : "Keep current", value: "" }, ...levels.map((level) => ({ label: levelLabels[level], value: level }))] as Array<{ label: string; value: "" | ReadingLevel }>).map((choice) => <button aria-pressed={editor.startingLevel === choice.value} className={editor.startingLevel === choice.value ? "is-selected" : ""} key={choice.value || "none"} onClick={() => setEditor({ ...editor, startingLevel: choice.value })} type="button">{choice.label}</button>)}</div></fieldset>
            {error ? <p className="dialog-error" role="alert">{error}</p> : null}
            <div className="roster-dialog-actions"><button className="quiet-action" disabled={isSaving} onClick={() => setEditor(null)} type="button">Cancel</button><button className="primary-action" disabled={isSaving || !nameIsValid} type="submit">{isSaving ? "Saving…" : editor.mode === "add" ? "Add child" : "Save changes"}</button></div>
          </form>
        </div>
      ) : null}
      {archiveTarget ? (
        <div aria-modal="true" className="roster-dialog-backdrop" role="dialog" aria-labelledby="archive-dialog-title">
          <section className="roster-dialog archive-confirm-dialog"><p>Archive child</p><h2 id="archive-dialog-title">Archive {archiveTarget.name}?</h2><span>They will be hidden from the class board. Their reading history stays safe.</span>{isDemoClassroom ? <strong>This is a demo child — nightly reset will restore them.</strong> : null}{error ? <p className="dialog-error" role="alert">{error}</p> : null}<div className="roster-dialog-actions"><button className="quiet-action" disabled={isSaving} onClick={() => setArchiveTarget(null)} type="button">Cancel</button><button className="archive-confirm-action" disabled={isSaving} onClick={() => void setArchived(archiveTarget, true)} type="button">{isSaving ? "Archiving…" : "Archive child"}</button></div></section>
        </div>
      ) : null}
    </>
  );
}
