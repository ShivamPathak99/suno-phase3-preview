import { createFocusedCardTokens } from "./validation";
import type { PassageMeta, TokenMeta } from "./passage-catalog";
import type { SkillId } from "./skills-catalog";

export type CuratedCardLevel = "word" | "paragraph";

export type CuratedCard = {
  cardId: string;
  body: string;
  focusSkillId: SkillId;
  language: "en";
  level: CuratedCardLevel;
  question: string;
  title: string;
  tokens: TokenMeta[];
  v: "curated-card.v1";
  warmUpWords: string[];
};

type CuratedCardDefinition = Omit<CuratedCard, "tokens" | "v"> & {
  targetWords: string[];
};

function defineCard({ targetWords, ...card }: CuratedCardDefinition): CuratedCard {
  return {
    ...card,
    tokens: createFocusedCardTokens(card.body, card.focusSkillId, targetWords),
    v: "curated-card.v1",
  };
}

/**
 * Reviewed Stage-1 reading cards. Cards are deliberately code-owned: a later
 * generated card must pass the same validator before it can enter this path.
 */
export const curatedCardCatalog: CuratedCard[] = [
  defineCard({
    cardId: "en.hfw.the.card1",
    body: "The red kite rests by Riya. Then a soft wind lifts it over a tree. There is a tall wall near the road. Riya smiles. Her father holds a string while birds fly past.",
    focusSkillId: "en.hfw.the",
    language: "en",
    level: "word",
    question: "What lifts the kite?",
    targetWords: ["the", "then", "there"],
    title: "The Red Kite",
    warmUpWords: ["the", "then", "there"],
  }),
  defineCard({
    cardId: "en.hfw.the.card2",
    body: "The bus waits near a school gate. Then Meena sees a red seat. There is room beside her. Meena sits and waves to a friend. Her teacher waits nearby with a yellow umbrella.",
    focusSkillId: "en.hfw.the",
    language: "en",
    level: "word",
    question: "Where does the bus wait?",
    targetWords: ["the", "then", "there"],
    title: "The Bus Stop",
    warmUpWords: ["the", "then", "there"],
  }),
  defineCard({
    cardId: "en.hfw.the.card3",
    body: "The blue cup sits on a shelf. Then Sita fills it with water. There is a small plate beside it. Sita carries both things to her mother. Her mother sets a cloth beside it.",
    focusSkillId: "en.hfw.the",
    language: "en",
    level: "word",
    question: "What does Sita fill with water?",
    targetWords: ["the", "then", "there"],
    title: "The Blue Cup",
    warmUpWords: ["the", "then", "there"],
  }),
  defineCard({
    cardId: "en.hfw.is.card1",
    body: "This is a hat for Rohan. His blue hat feels soft. A cat sits by a bag. Rohan takes the hat home after school. Rohan walks along a quiet lane and waves to a friend.",
    focusSkillId: "en.hfw.is",
    language: "en",
    level: "word",
    question: "What color is the hat?",
    targetWords: ["this", "is", "his"],
    title: "This Is His Hat",
    warmUpWords: ["this", "is", "his"],
  }),
  defineCard({
    cardId: "en.hfw.is.card2",
    body: "This tin box is on a desk. His sister puts a red pen inside. A bell rings at noon. The box stays safe by the wall. A small clock ticks near a window. Sister smiles at the sound.",
    focusSkillId: "en.hfw.is",
    language: "en",
    level: "word",
    question: "What is inside the tin box?",
    targetWords: ["this", "is", "his"],
    title: "His Tin Box",
    warmUpWords: ["this", "is", "his"],
  }),
  defineCard({
    cardId: "en.hfw.is.card3",
    body: "This gift rests by Nita. His note says it is from a friend. Nita opens the paper and finds a small red pin inside. She shows the bright pin to her mother at home.",
    focusSkillId: "en.hfw.is",
    language: "en",
    level: "word",
    question: "What does Nita find inside?",
    targetWords: ["this", "his", "is"],
    title: "A Gift for Nita",
    warmUpWords: ["this", "is", "his"],
  }),
  defineCard({
    cardId: "en.cvc.short_a.card1",
    body: "A cat naps on a mat. Sam carries a map, a bag, and a red cap. The pet walks past a box. Sam smiles at the pet. A warm sun shines over a path near the gate.",
    focusSkillId: "en.cvc.short_a",
    language: "en",
    level: "word",
    question: "What does Sam carry?",
    targetWords: ["cat", "mat", "map", "bag", "cap"],
    title: "The Cat Map",
    warmUpWords: ["cat", "map", "bag"],
  }),
  defineCard({
    cardId: "en.cvc.short_a.card2",
    body: "Dad puts jam in a pan. A rat sits near a fan. Nan has a tan bag. Dad gives a small snack. Nan puts it by a mat after the meal.",
    focusSkillId: "en.cvc.short_a",
    language: "en",
    level: "word",
    question: "Where does Dad put the jam?",
    targetWords: ["jam", "pan", "rat", "fan", "bag"],
    title: "Jam in a Pan",
    warmUpWords: ["jam", "pan", "fan"],
  }),
  defineCard({
    cardId: "en.cvc.short_a.card3",
    body: "A van stops at the park. A man has a map, a cap, and a flag. A child grabs a bag. It rolls past a tall lamp. A dog naps under a bench while a girl sings.",
    focusSkillId: "en.cvc.short_a",
    language: "en",
    level: "word",
    question: "What does the child grab?",
    targetWords: ["van", "man", "map", "cap", "bag"],
    title: "Van at the Park",
    warmUpWords: ["van", "map", "cap"],
  }),
  defineCard({
    cardId: "en.cvc.short_i.card1",
    body: "A fish swims by a tin lid. Kim sits on a big log. A pin is in her kit. Kim picks it up and grins. Kim takes a drink and sits on a small rug.",
    focusSkillId: "en.cvc.short_i",
    language: "en",
    level: "word",
    question: "What does Kim pick up?",
    targetWords: ["fish", "tin", "pin", "kit"],
    title: "The Tin Fish",
    warmUpWords: ["fish", "tin", "pin"],
  }),
  defineCard({
    cardId: "en.cvc.short_i.card2",
    body: "Tim has a big tin cup. A pig sits in a pit. Tim finds a pin by the hill. He puts it in his kit. A pink bird sings above a big red tent.",
    focusSkillId: "en.cvc.short_i",
    language: "en",
    level: "word",
    question: "What does Tim find?",
    targetWords: ["tin", "pig", "pit", "pin", "kit"],
    title: "Tim and the Pig",
    warmUpWords: ["tin", "pig", "pin"],
  }),
  defineCard({
    cardId: "en.cvc.short_i.card3",
    body: "A red bin sits by a desk. Nita sees a fish in a dish. She has a pin and a big mitt. Nita smiles. Her little dog digs near a big hill.",
    focusSkillId: "en.cvc.short_i",
    language: "en",
    level: "word",
    question: "Where is the fish?",
    targetWords: ["bin", "fish", "dish", "pin", "mitt"],
    title: "The Red Bin",
    warmUpWords: ["fish", "dish", "pin"],
  }),
  defineCard({
    cardId: "en.digraph.sh.card1",
    body: "Shyam shops with his aunt. He sees a shiny ship toy, a shell, and fresh fish. Shyam picks a small red ball. His aunt puts it in a bag. They walk home.",
    focusSkillId: "en.digraph.sh",
    language: "en",
    level: "word",
    question: "What does Shyam pick?",
    targetWords: ["shops", "shiny", "ship", "shell", "fish"],
    title: "Shyam Shops",
    warmUpWords: ["ship", "shop", "fish"],
  }),
  defineCard({
    cardId: "en.digraph.sh.card2",
    body: "A fish swims in a dish of water. Rishi brings a shell to the pond. It splashes near a shiny rock. Rishi watches the water. A child walks past the pond with a small net.",
    focusSkillId: "en.digraph.sh",
    language: "en",
    level: "word",
    question: "What is near the shiny rock?",
    targetWords: ["fish", "dish", "shell", "splashes", "shiny"],
    title: "A Fish in the Dish",
    warmUpWords: ["fish", "dish", "shell"],
  }),
  defineCard({
    cardId: "en.digraph.sh.card3",
    body: "Sheela sees a small shop near the school. A shiny shell sits by a ship picture. She carries a brush to her uncle. They rest in the shade. A child waves from a path beside a small tree.",
    focusSkillId: "en.digraph.sh",
    language: "en",
    level: "word",
    question: "What sits by the ship picture?",
    targetWords: ["shop", "shiny", "shell", "ship", "brush"],
    title: "The Shop Shed",
    warmUpWords: ["shop", "shell", "ship"],
  }),
  defineCard({
    cardId: "en.digraph.ch.card1",
    body: "A chick finds a chip by a bench. Chitra has a lunch box and much milk. She shares a snack with her friend. They walk home and talk about a sunny day.",
    focusSkillId: "en.digraph.ch",
    language: "en",
    level: "word",
    question: "What does the chick find?",
    targetWords: ["chick", "chip", "chitra", "lunch", "much"],
    title: "Chip and the Chick",
    warmUpWords: ["chip", "chick", "lunch"],
  }),
  defineCard({
    cardId: "en.digraph.ch.card2",
    body: "Chinmay has a chat at the park. A chip falls from the lunch bag. Much later, he finds it near a bench. His mother meets him with a warm smile.",
    focusSkillId: "en.digraph.ch",
    language: "en",
    level: "word",
    question: "What falls from the lunch bag?",
    targetWords: ["chinmay", "chat", "chip", "lunch", "much"],
    title: "Chat at the Park",
    warmUpWords: ["chat", "chip", "lunch"],
  }),
  defineCard({
    cardId: "en.digraph.ch.card3",
    body: "Chaya finds a chest in a room. A chip, a peach, and lunch sit inside. She carries the box to her mum. Her father waits outside with a soft blue cloth.",
    focusSkillId: "en.digraph.ch",
    language: "en",
    level: "word",
    question: "What is inside the chest?",
    targetWords: ["chaya", "chest", "chip", "peach", "lunch"],
    title: "Chaya Finds a Chest",
    warmUpWords: ["chest", "chip", "peach"],
  }),
];

export function getCuratedCardsForSkill(
  focusSkillId: SkillId,
  level?: CuratedCardLevel,
) {
  return curatedCardCatalog.filter(
    (card) => card.focusSkillId === focusSkillId && (level === undefined || card.level === level),
  );
}

export function getCuratedCard(cardId: string) {
  return curatedCardCatalog.find((card) => card.cardId === cardId) ?? null;
}

/** Turns a selected card into the `passages` metadata shape for P2-T10. */
export function passageMetadataForCuratedCard(card: CuratedCard, passageId: string): PassageMeta {
  return {
    language: card.language,
    level: card.level,
    passageId,
    source: "focused_card",
    tokens: card.tokens.map((token) => ({ ...token })),
    version: 1,
  };
}
