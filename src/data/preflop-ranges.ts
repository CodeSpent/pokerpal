import { Position } from "@/types/poker";

export type RangePreset = "tight" | "standard" | "loose";

export interface PositionRange {
  position: Position;
  openRaise: string[];
  description: string;
}

// Helper to expand hand ranges (e.g., "77+" becomes all pairs 77 and above)
function expandRange(hands: string[]): string[] {
  const result: string[] = [];
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

  for (const hand of hands) {
    if (hand.includes('+')) {
      // Handle pair+, e.g., "77+"
      const base = hand.replace('+', '');
      if (base.length === 2 && base[0] === base[1]) {
        const startIndex = ranks.indexOf(base[0]);
        for (let i = 0; i <= startIndex; i++) {
          result.push(`${ranks[i]}${ranks[i]}`);
        }
      }
      // Handle suited+, e.g., "A5s+"
      else if (hand.endsWith('s+')) {
        const [high, low] = [hand[0], hand[1]];
        const highIndex = ranks.indexOf(high);
        const lowIndex = ranks.indexOf(low);
        for (let i = highIndex + 1; i <= lowIndex; i++) {
          result.push(`${high}${ranks[i]}s`);
        }
      }
      // Handle offsuit+
      else if (hand.endsWith('o+')) {
        const [high, low] = [hand[0], hand[1]];
        const highIndex = ranks.indexOf(high);
        const lowIndex = ranks.indexOf(low);
        for (let i = highIndex + 1; i <= lowIndex; i++) {
          result.push(`${high}${ranks[i]}o`);
        }
      }
    } else {
      result.push(hand);
    }
  }

  return result;
}

// TIGHT presets - Conservative GTO-based ranges (safe for beginners)
export const TIGHT_RANGES: Record<Position, PositionRange> = {
  UTG: {
    position: "UTG",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99",
      "AKs", "AQs", "AJs", "ATs",
      "KQs", "KJs",
      "QJs",
      "AKo", "AQo",
    ]),
    description: "Very tight range from early position. Only premium hands.",
  },
  UTG1: {
    position: "UTG1",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88",
      "AKs", "AQs", "AJs", "ATs", "A9s",
      "KQs", "KJs", "KTs",
      "QJs", "QTs",
      "JTs",
      "AKo", "AQo", "AJo",
    ]),
    description: "Slightly wider than UTG but still tight.",
  },
  UTG2: {
    position: "UTG2",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s",
      "KQs", "KJs", "KTs", "K9s",
      "QJs", "QTs",
      "JTs", "J9s",
      "T9s",
      "AKo", "AQo", "AJo", "ATo",
    ]),
    description: "Middle position range, still relatively tight.",
  },
  LJ: {
    position: "LJ",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s",
      "KQs", "KJs", "KTs", "K9s",
      "QJs", "QTs", "Q9s",
      "JTs", "J9s",
      "T9s", "T8s",
      "98s",
      "AKo", "AQo", "AJo", "ATo",
      "KQo",
    ]),
    description: "Lojack - can start widening slightly.",
  },
  HJ: {
    position: "HJ",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s",
      "QJs", "QTs", "Q9s",
      "JTs", "J9s", "J8s",
      "T9s", "T8s",
      "98s", "97s",
      "87s",
      "76s",
      "AKo", "AQo", "AJo", "ATo",
      "KQo", "KJo",
    ]),
    description: "Hijack - good position, wider range.",
  },
  CO: {
    position: "CO",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s",
      "QJs", "QTs", "Q9s", "Q8s",
      "JTs", "J9s", "J8s",
      "T9s", "T8s", "T7s",
      "98s", "97s", "96s",
      "87s", "86s",
      "76s", "75s",
      "65s", "64s",
      "54s",
      "AKo", "AQo", "AJo", "ATo", "A9o",
      "KQo", "KJo", "KTo",
      "QJo", "QTo",
      "JTo",
    ]),
    description: "Cutoff - strong position, can open wide.",
  },
  BTN: {
    position: "BTN",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s",
      "JTs", "J9s", "J8s", "J7s",
      "T9s", "T8s", "T7s",
      "98s", "97s", "96s",
      "87s", "86s", "85s",
      "76s", "75s", "74s",
      "65s", "64s",
      "54s", "53s",
      "43s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
      "KQo", "KJo", "KTo", "K9o", "K8o",
      "QJo", "QTo", "Q9o",
      "JTo", "J9o",
      "T9o",
    ]),
    description: "Button - best position, very wide range.",
  },
  SB: {
    position: "SB",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s",
      "JTs", "J9s", "J8s", "J7s",
      "T9s", "T8s", "T7s",
      "98s", "97s",
      "87s", "86s",
      "76s", "75s",
      "65s", "64s",
      "54s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o",
      "KQo", "KJo", "KTo", "K9o",
      "QJo", "QTo",
      "JTo",
    ]),
    description: "Small blind - raise/fold strategy, positional disadvantage.",
  },
  BB: {
    position: "BB",
    openRaise: [], // BB doesn't open raise, they defend
    description: "Big blind defends vs raises, doesn't open.",
  },
};

// STANDARD presets - Balanced default ranges
export const STANDARD_RANGES: Record<Position, PositionRange> = {
  UTG: {
    position: "UTG",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s",
      "KQs", "KJs", "KTs",
      "QJs", "QTs",
      "JTs",
      "AKo", "AQo", "AJo",
    ]),
    description: "Solid UTG range with some suited broadways.",
  },
  UTG1: {
    position: "UTG1",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s",
      "KQs", "KJs", "KTs", "K9s",
      "QJs", "QTs", "Q9s",
      "JTs", "J9s",
      "T9s",
      "98s",
      "AKo", "AQo", "AJo", "ATo",
    ]),
    description: "UTG+1 with more suited connectors.",
  },
  UTG2: {
    position: "UTG2",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s",
      "KQs", "KJs", "KTs", "K9s", "K8s",
      "QJs", "QTs", "Q9s",
      "JTs", "J9s",
      "T9s", "T8s",
      "98s", "97s",
      "87s",
      "76s",
      "AKo", "AQo", "AJo", "ATo",
      "KQo",
    ]),
    description: "Middle position with suited aces and connectors.",
  },
  LJ: {
    position: "LJ",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s",
      "QJs", "QTs", "Q9s", "Q8s",
      "JTs", "J9s", "J8s",
      "T9s", "T8s",
      "98s", "97s",
      "87s", "86s",
      "76s", "75s",
      "65s",
      "54s",
      "AKo", "AQo", "AJo", "ATo", "A9o",
      "KQo", "KJo",
    ]),
    description: "Lojack with all suited aces.",
  },
  HJ: {
    position: "HJ",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s",
      "JTs", "J9s", "J8s", "J7s",
      "T9s", "T8s", "T7s",
      "98s", "97s", "96s",
      "87s", "86s",
      "76s", "75s",
      "65s", "64s",
      "54s",
      "AKo", "AQo", "AJo", "ATo", "A9o",
      "KQo", "KJo", "KTo",
      "QJo",
    ]),
    description: "Hijack with all pocket pairs.",
  },
  CO: {
    position: "CO",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s",
      "JTs", "J9s", "J8s", "J7s", "J6s",
      "T9s", "T8s", "T7s", "T6s",
      "98s", "97s", "96s",
      "87s", "86s", "85s",
      "76s", "75s", "74s",
      "65s", "64s", "63s",
      "54s", "53s",
      "43s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o",
      "KQo", "KJo", "KTo", "K9o",
      "QJo", "QTo", "Q9o",
      "JTo", "J9o",
      "T9o",
    ]),
    description: "Cutoff with very wide suited range.",
  },
  BTN: {
    position: "BTN",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s",
      "JTs", "J9s", "J8s", "J7s", "J6s", "J5s",
      "T9s", "T8s", "T7s", "T6s",
      "98s", "97s", "96s", "95s",
      "87s", "86s", "85s", "84s",
      "76s", "75s", "74s",
      "65s", "64s", "63s",
      "54s", "53s", "52s",
      "43s", "42s",
      "32s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
      "KQo", "KJo", "KTo", "K9o", "K8o", "K7o",
      "QJo", "QTo", "Q9o", "Q8o",
      "JTo", "J9o", "J8o",
      "T9o", "T8o",
      "98o",
    ]),
    description: "Button opens extremely wide.",
  },
  SB: {
    position: "SB",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s",
      "JTs", "J9s", "J8s", "J7s", "J6s",
      "T9s", "T8s", "T7s", "T6s",
      "98s", "97s", "96s",
      "87s", "86s", "85s",
      "76s", "75s", "74s",
      "65s", "64s",
      "54s", "53s",
      "43s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o",
      "KQo", "KJo", "KTo", "K9o", "K8o",
      "QJo", "QTo", "Q9o",
      "JTo", "J9o",
      "T9o",
    ]),
    description: "SB raise vs BB - wide but selective.",
  },
  BB: {
    position: "BB",
    openRaise: [],
    description: "Big blind defends vs raises, doesn't open.",
  },
};

// LOOSE presets - Wider LAG-style ranges
export const LOOSE_RANGES: Record<Position, PositionRange> = {
  UTG: {
    position: "UTG",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s",
      "QJs", "QTs", "Q9s",
      "JTs", "J9s",
      "T9s", "T8s",
      "98s", "97s",
      "87s",
      "76s",
      "65s",
      "AKo", "AQo", "AJo", "ATo",
      "KQo",
    ]),
    description: "Aggressive UTG with all suited aces and connectors.",
  },
  UTG1: {
    position: "UTG1",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s",
      "QJs", "QTs", "Q9s", "Q8s",
      "JTs", "J9s", "J8s",
      "T9s", "T8s", "T7s",
      "98s", "97s",
      "87s", "86s",
      "76s", "75s",
      "65s", "64s",
      "54s",
      "AKo", "AQo", "AJo", "ATo", "A9o",
      "KQo", "KJo",
    ]),
    description: "Wide UTG+1 with suited gappers.",
  },
  UTG2: {
    position: "UTG2",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s",
      "JTs", "J9s", "J8s", "J7s",
      "T9s", "T8s", "T7s",
      "98s", "97s", "96s",
      "87s", "86s", "85s",
      "76s", "75s",
      "65s", "64s",
      "54s", "53s",
      "43s",
      "AKo", "AQo", "AJo", "ATo", "A9o",
      "KQo", "KJo", "KTo",
    ]),
    description: "Aggressive MP with more offsuit broadways.",
  },
  LJ: {
    position: "LJ",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s",
      "JTs", "J9s", "J8s", "J7s", "J6s",
      "T9s", "T8s", "T7s", "T6s",
      "98s", "97s", "96s",
      "87s", "86s", "85s",
      "76s", "75s", "74s",
      "65s", "64s", "63s",
      "54s", "53s",
      "43s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o",
      "KQo", "KJo", "KTo",
      "QJo", "QTo",
    ]),
    description: "Very wide LJ with all pocket pairs.",
  },
  HJ: {
    position: "HJ",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s",
      "JTs", "J9s", "J8s", "J7s", "J6s", "J5s",
      "T9s", "T8s", "T7s", "T6s", "T5s",
      "98s", "97s", "96s", "95s",
      "87s", "86s", "85s", "84s",
      "76s", "75s", "74s",
      "65s", "64s", "63s",
      "54s", "53s", "52s",
      "43s", "42s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o",
      "KQo", "KJo", "KTo", "K9o",
      "QJo", "QTo", "Q9o",
      "JTo",
    ]),
    description: "Aggressive HJ exploiting position.",
  },
  CO: {
    position: "CO",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s",
      "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s",
      "T9s", "T8s", "T7s", "T6s", "T5s",
      "98s", "97s", "96s", "95s", "94s",
      "87s", "86s", "85s", "84s", "83s",
      "76s", "75s", "74s", "73s",
      "65s", "64s", "63s", "62s",
      "54s", "53s", "52s",
      "43s", "42s",
      "32s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
      "KQo", "KJo", "KTo", "K9o", "K8o", "K7o", "K6o",
      "QJo", "QTo", "Q9o", "Q8o",
      "JTo", "J9o", "J8o",
      "T9o", "T8o",
      "98o", "97o",
      "87o",
    ]),
    description: "Very wide CO to attack blinds.",
  },
  BTN: {
    position: "BTN",
    openRaise: expandRange([
      // Essentially any two cards with reasonable playability
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s",
      "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s", "J3s", "J2s",
      "T9s", "T8s", "T7s", "T6s", "T5s", "T4s", "T3s", "T2s",
      "98s", "97s", "96s", "95s", "94s", "93s", "92s",
      "87s", "86s", "85s", "84s", "83s", "82s",
      "76s", "75s", "74s", "73s", "72s",
      "65s", "64s", "63s", "62s",
      "54s", "53s", "52s",
      "43s", "42s",
      "32s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
      "KQo", "KJo", "KTo", "K9o", "K8o", "K7o", "K6o", "K5o", "K4o", "K3o", "K2o",
      "QJo", "QTo", "Q9o", "Q8o", "Q7o", "Q6o", "Q5o",
      "JTo", "J9o", "J8o", "J7o", "J6o",
      "T9o", "T8o", "T7o", "T6o",
      "98o", "97o", "96o",
      "87o", "86o", "85o",
      "76o", "75o",
      "65o", "64o",
      "54o",
    ]),
    description: "Extremely wide button - attack the blinds relentlessly.",
  },
  SB: {
    position: "SB",
    openRaise: expandRange([
      "AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22",
      "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
      "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
      "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s",
      "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s",
      "T9s", "T8s", "T7s", "T6s", "T5s",
      "98s", "97s", "96s", "95s",
      "87s", "86s", "85s", "84s",
      "76s", "75s", "74s",
      "65s", "64s", "63s",
      "54s", "53s", "52s",
      "43s", "42s",
      "32s",
      "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o",
      "KQo", "KJo", "KTo", "K9o", "K8o", "K7o", "K6o",
      "QJo", "QTo", "Q9o", "Q8o", "Q7o",
      "JTo", "J9o", "J8o",
      "T9o", "T8o",
      "98o", "97o",
      "87o",
    ]),
    description: "Very wide SB raise vs BB.",
  },
  BB: {
    position: "BB",
    openRaise: [],
    description: "Big blind defends vs raises, doesn't open.",
  },
};

// Get ranges for a specific preset
export function getRangesByPreset(preset: RangePreset): Record<Position, PositionRange> {
  switch (preset) {
    case "tight":
      return TIGHT_RANGES;
    case "standard":
      return STANDARD_RANGES;
    case "loose":
      return LOOSE_RANGES;
    default:
      return STANDARD_RANGES;
  }
}

// Get a specific position's range for a preset
export function getPositionRange(position: Position, preset: RangePreset): PositionRange {
  return getRangesByPreset(preset)[position];
}

// Preset descriptions
export const PRESET_INFO: Record<RangePreset, { name: string; description: string }> = {
  tight: {
    name: "Tight",
    description: "Conservative GTO-based ranges. Safe for beginners and tough games.",
  },
  standard: {
    name: "Standard",
    description: "Balanced default ranges suitable for most games.",
  },
  loose: {
    name: "Loose",
    description: "Wider LAG-style ranges for aggressive play and soft games.",
  },
};
