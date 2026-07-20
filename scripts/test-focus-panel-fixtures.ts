import assert from "node:assert/strict";

import {
  focusPanelDebugModes,
  getFocusPanelDebugRecommendation,
  parseFocusPanelDebugMode,
} from "../src/lib/adaptive/focus-panel-fixtures";

assert.deepEqual(focusPanelDebugModes, ["focus", "general", "cold-start", "strategy-needed"]);
assert.equal(parseFocusPanelDebugMode("focus"), "focus");
assert.equal(parseFocusPanelDebugMode("not-a-state"), undefined);

const focus = getFocusPanelDebugRecommendation("focus", "Maya");
assert.equal(focus.kind, "focused_card");
assert.equal(focus.kind === "focused_card" && focus.skillId, "en.digraph.sh");

const general = getFocusPanelDebugRecommendation("general", "Maya");
assert.equal(general.kind, "general_card");
assert.equal(general.kind === "general_card" && general.source, "general");

const coldStart = getFocusPanelDebugRecommendation("cold-start", "Maya");
assert.equal(coldStart.kind, "general_card");
assert.equal(coldStart.kind === "general_card" && coldStart.source, "cold_start");

const strategy = getFocusPanelDebugRecommendation("strategy-needed", "Maya");
assert.equal(strategy.kind, "teacher_strategy_needed");
assert.equal(strategy.kind === "teacher_strategy_needed" && strategy.alternatives.length, 3);

console.log("P2-T8 focus panel fixtures passed: all four teacher states are reachable.");
