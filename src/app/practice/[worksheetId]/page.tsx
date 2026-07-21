import { notFound } from "next/navigation";

import { AdaptiveCardPage } from "@/components/adaptive-card-page";
import { parseStoredAdaptiveWorksheet } from "@/lib/adaptive/card-view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PracticePageProps = {
  params: Promise<{ worksheetId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
}

function childView(value: string | string[] | undefined) {
  return value === "child";
}

export default async function PracticeCardPage({ params, searchParams }: PracticePageProps) {
  const [{ worksheetId }, query] = await Promise.all([params, searchParams]);

  if (!isUuid(worksheetId)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("worksheets")
    .select("content_json")
    .eq("id", worksheetId)
    .maybeSingle<{ content_json: unknown }>();

  if (error || !data) {
    notFound();
  }

  const card = parseStoredAdaptiveWorksheet(data.content_json);

  if (!card) {
    notFound();
  }

  return <AdaptiveCardPage card={card} mode={childView(query.view) ? "child" : "teacher"} worksheetId={worksheetId} />;
}
