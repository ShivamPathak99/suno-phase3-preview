import Link from "next/link";
import { notFound } from "next/navigation";

import { buildStudentTimeline, type TimelineAssessment } from "@/lib/analytics/student-timeline";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const levelLabels = { letter: "Letter", word: "Word", paragraph: "Paragraph", story: "Story" } as const;

export default async function StudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: student, error: studentError }, { data: assessments, error: assessmentsError }] = await Promise.all([
    supabase.from("students").select("id, name, is_archived").eq("id", studentId).maybeSingle<{ id: string; is_archived: boolean | null; name: string }>(),
    supabase.from("assessments").select("id, level, accuracy, wcpm, created_at, analysis_json, teacher_confirmed").eq("student_id", studentId).eq("teacher_confirmed", true).order("created_at", { ascending: true }),
  ]);
  if (studentError || assessmentsError) throw new Error("Couldn't load this student's learning journey.");
  if (!student) notFound();

  const timeline = buildStudentTimeline({ assessments: (assessments ?? []) as TimelineAssessment[], studentId });
  const hasBenchmark = timeline.trends.length > 0;

  return (
    <main className="student-page">
      <section className="student-shell">
        <header className="student-page-header">
          <Link className="back-link" href="/">Class</Link>
          <div><p>Learning journey</p><h1>{student.name}</h1></div>
          {!student.is_archived ? <Link className="primary-action" href={`/assess/${student.id}`}>Assess</Link> : null}
        </header>
        {student.is_archived ? <p className="student-readonly">Archived child — this history is read-only.</p> : null}
        {!hasBenchmark ? (
          <section className="student-empty"><h2>No benchmark readings yet</h2><p>Start with a short reading check. Practice activity will appear here separately.</p>{!student.is_archived ? <Link className="primary-action" href={`/assess/${student.id}`}>Start reading check</Link> : null}</section>
        ) : (
          <>
            <section className="student-panel"><p className="student-panel-kicker">Current placement</p><h2>{timeline.latestLevel ? `${levelLabels[timeline.latestLevel]} level` : "Reading journey"}</h2><p>{timeline.trends.length === 1 ? "1 reading — too early for a trend." : `${timeline.trends.length} benchmark readings in this view.`}</p></section>
            <section className="student-panel"><p className="student-panel-kicker">Reading trends</p><h2>Accuracy and pace</h2><ul className="student-trend-list">{timeline.trends.map((point) => <li key={point.id}><span>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(point.date))}</span><strong>{point.accuracy}%</strong><span>{point.wcpm} WCPM</span><Link href={`/assess/${student.id}?assessmentId=${point.id}`}>View</Link></li>)}</ul></section>
            <section className="student-panel"><p className="student-panel-kicker">Skill map</p><h2>What to practise next</h2><ul className="student-skill-list">{Object.values(timeline.profile.skills).filter((skill) => skill.accuracy.nEffective > 0).map((skill) => <li key={skill.id}>{skill.id.replace("en.", "").replace(/\./gu, " ")} <span>{skill.state === "mastered" ? "secure" : skill.state === "review_due" ? "ready to review" : skill.state === "active" ? "growing" : "practising"}</span></li>)}</ul></section>
          </>
        )}
        <section className="student-panel"><p className="student-panel-kicker">Practice activity</p><h2>{timeline.practiceReadCount} practice {timeline.practiceReadCount === 1 ? "read" : "reads"}</h2><p>Practice supports learning but never changes benchmark trends or placement.</p></section>
        <section className="student-panel"><p className="student-panel-kicker">Reading diary</p><h2>Confirmed checks</h2><ul className="student-diary">{timeline.diary.length ? timeline.diary.slice(0, 20).map((entry) => <li key={entry.id}><span>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(entry.date))}</span><span>{entry.purpose === "focused_readback" ? "Practice read" : "Benchmark read"}</span><Link href={`/assess/${student.id}?assessmentId=${entry.id}`}>Open</Link></li>) : <li>No readings saved yet.</li>}</ul></section>
      </section>
    </main>
  );
}
