export type SkillId =
  | "en.hfw.the"
  | "en.hfw.is"
  | "en.cvc.short_a"
  | "en.cvc.short_i"
  | "en.digraph.sh"
  | "en.digraph.ch";

export type Skill = {
  id: SkillId;
  displayName: string;
  language: "en";
  kind: "sight_word" | "cvc" | "digraph";
  aserBands: Array<"letter" | "word" | "paragraph" | "story">;
  prerequisites: SkillId[];
  practiceMode: "decode" | "automaticity";
  exampleWords: string[];
};

/**
 * The complete V1 reading taxonomy. Future algorithms always consult this
 * catalog rather than encoding behavior for individual skill IDs.
 */
export const readingSkillCatalog: Skill[] = [
  {
    id: "en.hfw.the",
    displayName: "the",
    language: "en",
    kind: "sight_word",
    aserBands: ["word", "paragraph", "story"],
    prerequisites: [],
    practiceMode: "automaticity",
    exampleWords: ["the", "then", "there"],
  },
  {
    id: "en.hfw.is",
    displayName: "is",
    language: "en",
    kind: "sight_word",
    aserBands: ["word", "paragraph", "story"],
    prerequisites: [],
    practiceMode: "automaticity",
    exampleWords: ["is", "his", "this"],
  },
  {
    id: "en.cvc.short_a",
    displayName: "short-a words",
    language: "en",
    kind: "cvc",
    aserBands: ["word", "paragraph", "story"],
    prerequisites: [],
    practiceMode: "decode",
    exampleWords: ["cat", "map", "bag"],
  },
  {
    id: "en.cvc.short_i",
    displayName: "short-i words",
    language: "en",
    kind: "cvc",
    aserBands: ["word", "paragraph", "story"],
    prerequisites: [],
    practiceMode: "decode",
    exampleWords: ["sit", "pin", "fish"],
  },
  {
    id: "en.digraph.sh",
    displayName: "sh words",
    language: "en",
    kind: "digraph",
    aserBands: ["word", "paragraph", "story"],
    prerequisites: ["en.cvc.short_a", "en.cvc.short_i"],
    practiceMode: "decode",
    exampleWords: ["ship", "shop", "fish"],
  },
  {
    id: "en.digraph.ch",
    displayName: "ch words",
    language: "en",
    kind: "digraph",
    aserBands: ["word", "paragraph", "story"],
    prerequisites: ["en.cvc.short_a", "en.cvc.short_i"],
    practiceMode: "decode",
    exampleWords: ["chip", "chat", "much"],
  },
];

export const readingSkillById: Record<SkillId, Skill> = Object.fromEntries(
  readingSkillCatalog.map((skill) => [skill.id, skill]),
) as Record<SkillId, Skill>;
