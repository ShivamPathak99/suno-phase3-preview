import { notFound } from "next/navigation";

import { WorksheetPage } from "@/components/worksheet-page";
import { isWorksheetLevel } from "@/lib/worksheet-route";

type WorksheetRouteProps = {
  params: Promise<{
    level: string;
  }>;
};

/** C-5 print-first route. The current demo surface intentionally starts in English. */
export default async function WorksheetRoute({ params }: WorksheetRouteProps) {
  const { level } = await params;

  if (!isWorksheetLevel(level)) {
    notFound();
  }

  return <WorksheetPage key={level} language="en" level={level} />;
}
