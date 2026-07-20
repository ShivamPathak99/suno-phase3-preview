import { MathCheckFlow } from "@/components/math-check-flow";

export const dynamic = "force-dynamic";

export default async function MathCheckPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <MathCheckFlow studentId={studentId} />;
}
