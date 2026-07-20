/**
 * Deterministic buggy-algorithm predictions from Phase 2 spec §B2.
 *
 * These functions return the answer a child using that procedure would write,
 * not a judgement about whether that procedure is appropriate for an item.
 * A prediction equal to the correct answer is harmless: diagnosis only
 * considers a function after the child has supplied a wrong answer.
 */
export type BugId =
  | "add.dropped_carry"
  | "add.carry_as_digit"
  | "add.carry_added_twice"
  | "add.no_place_value"
  | "sub.smaller_from_larger"
  | "sub.borrow_no_decrement"
  | "sub.zero_gives_zero"
  | "sub.zero_takes_n";

export type MathBugItem = {
  a: number;
  b: number;
  op: "+" | "-";
};

export type MathBug = {
  displayName: string;
  id: BugId;
  pred: (item: MathBugItem) => number;
};

function tens(value: number) {
  return Math.floor(value / 10) % 10;
}

function units(value: number) {
  return value % 10;
}

function requireOperation(item: MathBugItem, op: MathBugItem["op"]) {
  if (item.op !== op) {
    throw new Error(`Bug prediction requires a ${op} item.`);
  }
}

function additionColumns(item: MathBugItem) {
  requireOperation(item, "+");
  const unitsTotal = units(item.a) + units(item.b);
  const carry = Math.floor(unitsTotal / 10);

  return {
    carry,
    tensTotal: tens(item.a) + tens(item.b),
    unitsTotal,
  };
}

function subtractionColumns(item: MathBugItem) {
  requireOperation(item, "-");
  return {
    minuendTens: tens(item.a),
    minuendUnits: units(item.a),
    subtrahendTens: tens(item.b),
    subtrahendUnits: units(item.b),
  };
}

/** The full Phase 2 §B2 catalog, keyed by its stable diagnosis ID. */
export const bugCatalog: Record<BugId, MathBug> = {
  "add.dropped_carry": {
    displayName: "dropped the carry",
    id: "add.dropped_carry",
    pred: (item) => {
      const columns = additionColumns(item);
      return columns.tensTotal * 10 + (columns.unitsTotal % 10);
    },
  },
  "add.carry_as_digit": {
    displayName: "wrote the carry as a digit",
    id: "add.carry_as_digit",
    pred: (item) => {
      const columns = additionColumns(item);
      return Number(`${columns.tensTotal}${columns.unitsTotal}`);
    },
  },
  "add.carry_added_twice": {
    displayName: "added the carry twice",
    id: "add.carry_added_twice",
    pred: (item) => {
      const columns = additionColumns(item);
      return (columns.tensTotal + 2 * columns.carry) * 10 + (columns.unitsTotal % 10);
    },
  },
  "add.no_place_value": {
    displayName: "added every digit as ones",
    id: "add.no_place_value",
    pred: (item) => {
      requireOperation(item, "+");
      return tens(item.a) + units(item.a) + tens(item.b) + units(item.b);
    },
  },
  "sub.smaller_from_larger": {
    displayName: "subtracted the smaller digit from the larger digit",
    id: "sub.smaller_from_larger",
    pred: (item) => {
      const columns = subtractionColumns(item);
      return (
        Math.abs(columns.minuendTens - columns.subtrahendTens) * 10 +
        Math.abs(columns.minuendUnits - columns.subtrahendUnits)
      );
    },
  },
  "sub.borrow_no_decrement": {
    displayName: "borrowed without reducing the tens",
    id: "sub.borrow_no_decrement",
    pred: (item) => {
      const columns = subtractionColumns(item);
      const borrowedUnits =
        columns.minuendUnits < columns.subtrahendUnits
          ? columns.minuendUnits + 10 - columns.subtrahendUnits
          : columns.minuendUnits - columns.subtrahendUnits;
      return (columns.minuendTens - columns.subtrahendTens) * 10 + borrowedUnits;
    },
  },
  "sub.zero_gives_zero": {
    displayName: "made a zero difference whenever zero appeared",
    id: "sub.zero_gives_zero",
    pred: (item) => {
      requireOperation(item, "-");
      if (item.a === 0 || item.b === 0) {
        return 0;
      }

      return item.a - item.b;
    },
  },
  "sub.zero_takes_n": {
    displayName: "made zero take the other digit",
    id: "sub.zero_takes_n",
    pred: (item) => {
      const columns = subtractionColumns(item);
      const subtractColumn = (minuend: number, subtrahend: number) =>
        minuend === 0 ? subtrahend : minuend - subtrahend;

      return (
        subtractColumn(columns.minuendTens, columns.subtrahendTens) * 10 +
        subtractColumn(columns.minuendUnits, columns.subtrahendUnits)
      );
    },
  },
};

export const mathBugIds = Object.keys(bugCatalog) as BugId[];
