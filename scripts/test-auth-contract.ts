import assert from "node:assert/strict";

import { isPublicAppPath, loginRedirectPath } from "../src/lib/auth/middleware";
import { parseTeacherProvisioningArgs } from "../src/lib/auth/provisioning";
import { safeNextPath } from "../src/lib/auth/redirects";

assert.equal(isPublicAppPath("/login"), true);
assert.equal(isPublicAppPath("/why"), true);
assert.equal(isPublicAppPath("/"), false);
assert.equal(isPublicAppPath("/assess/student"), false);
assert.equal(loginRedirectPath("/assess/student", "?from=card"), "/login?next=%2Fassess%2Fstudent%3Ffrom%3Dcard");
assert.equal(safeNextPath("/math/student"), "/math/student");
assert.equal(safeNextPath("//attacker.example"), "/");
assert.equal(safeNextPath("https://attacker.example"), "/");
assert.equal(safeNextPath("/\\attacker.example"), "/");

assert.deepEqual(
  parseTeacherProvisioningArgs([
    "--email",
    "Teacher@School.example",
    "--classroom",
    "Class 3A",
    "--grade",
    "3",
  ]),
  { classroomName: "Class 3A", email: "teacher@school.example", grade: "3" },
);
assert.throws(() => parseTeacherProvisioningArgs(["--email", "not-an-email", "--classroom", "Class 3A"]));
assert.throws(() => parseTeacherProvisioningArgs(["--email", "teacher@school.example"]));
assert.throws(() => parseTeacherProvisioningArgs(["--email", "teacher@school.example", "--unknown", "value"]));

console.log("P3-T3 auth contract passed: public paths, safe next redirects, and preview provisioning input.");
