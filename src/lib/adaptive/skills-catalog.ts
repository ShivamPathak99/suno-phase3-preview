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
