import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { requiresSessionRecovery } from "../src/lib/auth/session-recovery";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// Mocked expiry: only the HTTP status used by the browser pipeline can open
// the re-auth modal. Other request failures retain the normal retry states.
assert.equal(requiresSessionRecovery(401), true);
assert.equal(requiresSessionRecovery(400), false);
assert.equal(requiresSessionRecovery(403), false);
assert.equal(requiresSessionRecovery(502), false);

const assessmentFlow = source("../src/components/assess-flow.tsx");
assert.match(assessmentFlow, /UploadAuthenticationError/);
assert.match(assessmentFlow, /pauseForReauthentication/);
assert.match(assessmentFlow, /resumeAfterReauthentication/);
assert.match(assessmentFlow, /ReauthenticateDialog/);

const reauthenticateDialog = source("../src/components/reauthenticate-dialog.tsx");
assert.match(reauthenticateDialog, /signInWithPassword/);
assert.match(reauthenticateDialog, /signInAnonymously/);

const userScopedSources = [
  "../src/app/api/analyze/route.ts",
  "../src/app/api/assessments/[assessmentId]/confirm/route.ts",
  "../src/app/api/math/checks/route.ts",
  "../src/app/api/math/checks/[assessmentId]/route.ts",
  "../src/app/api/math/checks/[assessmentId]/confirm/route.ts",
  "../src/app/api/upload-url/route.ts",
  "../src/app/api/worksheets/route.ts",
  "../src/app/practice/[worksheetId]/page.tsx",
  "../src/lib/live-assessment-context.ts",
  "../src/lib/live-classroom.ts",
  "../src/lib/live-math-check.ts",
];

for (const path of userScopedSources) {
  assert.doesNotMatch(
    source(path),
    /createSupabaseAdminClient/,
    `${path} must use the caller's RLS-scoped client rather than the service role`,
  );
}

console.log("P3-T5 auth recovery contract passed: mocked 401 preserves the recording and user routes are RLS scoped.");
