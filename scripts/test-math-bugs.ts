import assert from "node:assert/strict";

import { bugCatalog } from "../src/lib/adaptive/math/bug-catalog";

const addFingerprint = { a: 47, b: 25, op: "+" as const };
const subtractionFingerprint = { a: 52, b: 38, op: "-" as const };

assert.equal(bugCatalog["add.dropped_carry"].pred(addFingerprint), 62);
assert.equal(bugCatalog["add.carry_as_digit"].pred(addFingerprint), 612);
assert.equal(bugCatalog["add.carry_added_twice"].pred(addFingerprint), 82);
assert.equal(bugCatalog["add.no_place_value"].pred(addFingerprint), 18);
assert.equal(bugCatalog["sub.smaller_from_larger"].pred(subtractionFingerprint), 26);
assert.equal(bugCatalog["sub.borrow_no_decrement"].pred(subtractionFingerprint), 24);
assert.equal(bugCatalog["sub.zero_gives_zero"].pred({ a: 30, b: 0, op: "-" }), 0);
assert.equal(bugCatalog["sub.zero_takes_n"].pred({ a: 40, b: 7, op: "-" }), 47);

console.log("P2-T17 math bug fingerprints passed verbatim.");
