import Link from "next/link";
import { notFound } from "next/navigation";

import { buildStudentTimeline, type TimelineAssessment } from "@/lib/analytics/student-timeline";
import { PrintReportButton } from "@/components/print-report-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentReportPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: student }, { data: assessments }] = await Promise.all([
    supabase.from("students").select("id, name").eq("id", studentId).maybeSingle<{ id: string; name: string }>(),
    supabase.from("assessments").select("id, level, accuracy, wcpm, created_at, analysis_json, teacher_confirmed").eq("student_id", studentId).eq("teacher_confirmed", true).order("created_at", { ascending: true }),
  ]);
  if (!student) notFound();
  const timeline = buildStudentTimeline({ assessments: (assessments ?? []) as TimelineAssessment[], studentId });
  const skills = Object.values(timeline.profile.skills).filter((skill) => skill.accuracy.nEffective > 0);
  const strengths = skills.sort((a, b) => b.accuracy.lcb90 - a.accuracy.lcb90).slice(0, 2);
  const focus = skills.sort((a, b) => a.accuracy.lcb90 - b.accuracy.lcb90)[0];
  return <main className="parent-report"><section className="parent-report-sheet"><div className="report-actions"><Link href={`/student/${student.id}`}>Back to journey</Link><PrintReportButton /></div><p className="report-wordmark">Suno</p><h1>{student.name}&apos;s reading journey</h1><p className="report-date">A simple snapshot to share at home</p><section><h2>Growing strengths</h2><p>{strengths.length ? strengths.map((skill) => skill.id.replace("en.", "").replace(/\./gu, " ")).join(" and ") : "Every reading together builds confidence."}</p></section><section><h2>One useful focus</h2><p>{focus ? `${focus.id.replace("en.", "").replace(/\./gu, " ")} — short, relaxed practice is enough.` : "Enjoy a short, familiar story together."}</p></section><section><h2>Try at home</h2><p>Let {student.name} choose a short story, read a little each day, and celebrate returning to a tricky word.</p></section><section><h2>Reading activity</h2><p>{timeline.trends.length} benchmark {timeline.trends.length === 1 ? "check" : "checks"} and {timeline.practiceReadCount} practice {timeline.practiceReadCount === 1 ? "read" : "reads"} recorded.</p></section><p className="report-footer">This is a teacher-supported learning snapshot, not a test scorecard.</p></section></main>;
}
