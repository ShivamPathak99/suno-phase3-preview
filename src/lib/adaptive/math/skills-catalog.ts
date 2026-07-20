/** Phase 2 spec §B1 — the V1 addition and subtraction practice taxonomy. */
export type MathSkillId =
  | "math.add.facts20"
  | "math.add.no_carry"
  | "math.add.carry"
  | "math.sub.facts20"
  | "math.sub.no_borrow"
  | "math.sub.borrow";

export type MathSkill = {
  displayName: string;
  id: MathSkillId;
  prerequisites: MathSkillId[];
  subject: "math";
};

export const mathSkillCatalog: readonly MathSkill[] = [
  {
    displayName: "addition facts within 20",
    id: "math.add.facts20",
    prerequisites: [],
    subject: "math",
  },
  {
    displayName: "addition without carrying",
    id: "math.add.no_carry",
    prerequisites: ["math.add.facts20"],
    subject: "math",
  },
  {
    displayName: "carrying in addition",
    id: "math.add.carry",
    prerequisites: ["math.add.no_carry"],
    subject: "math",
  },
  {
    displayName: "subtraction facts within 20",
    id: "math.sub.facts20",
    prerequisites: [],
    subject: "math",
  },
  {
    displayName: "subtraction without borrowing",
    id: "math.sub.no_borrow",
    prerequisites: ["math.sub.facts20"],
    subject: "math",
  },
  {
    displayName: "borrowing in subtraction",
    id: "math.sub.borrow",
    prerequisites: ["math.sub.no_borrow"],
    subject: "math",
  },
];

export const mathSkillIds = mathSkillCatalog.map((skill) => skill.id) as MathSkillId[];
