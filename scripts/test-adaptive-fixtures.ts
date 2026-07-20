import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Fixture = Record<string, unknown>;

const fixturesDirectory = resolve(import.meta.dirname, "..", "src", "lib", "adaptive", "__fixtures__");

function loadFixture(fileName: string): Fixture {
  return JSON.parse(readFileSync(resolve(fixturesDirectory, fileName), "utf8")) as Fixture;
}

const maya = loadFixture("maya-evidence.json");
const wordLevelGroup = loadFixture("word-level-group.json");
const paragraphMixedGroup = loadFixture("paragraph-mixed-group.json");
const expectedOutputs = loadFixture("expected-outputs.json");

assert.equal(maya.fixture, "adaptive-reading.maya.v1");
assert.equal(wordLevelGroup.fixture, "adaptive-reading.word-group.v1");
assert.equal(paragraphMixedGroup.fixture, "adaptive-reading.paragraph-mixed-group.v1");
assert.equal(expectedOutputs.fixture, "adaptive-reading.expected-outputs.v1");

console.log("P2-T2 adaptive fixtures load successfully.");
