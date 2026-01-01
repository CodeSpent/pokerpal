import { Position } from "@/types/poker";

// Push ranges by stack size (in BB) and position
// Based on Nash equilibrium push/fold charts for 6-max

export interface PushRange {
  stackSize: number;
  position: Position;
  hands: string[];
}

// All hands for reference
const ALL_PAIRS = ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22"];
const BROADWAY_SUITED = ["AKs", "AQs", "AJs", "ATs", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs"];
const BROADWAY_OFFSUIT = ["AKo", "AQo", "AJo", "ATo", "KQo", "KJo", "KTo", "QJo", "QTo", "JTo"];

// Push ranges by position and stack size
export const PUSH_RANGES: Record<number, Record<Position, string[]>> = {
  // 3 BB - Push very wide from late position
  3: {
    UTG: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "JTs", "AKo", "AQo", "AJo", "ATo", "KQo"],
    UTG1: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "JTs", "AKo", "AQo", "AJo", "ATo", "KQo"],
    UTG2: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo"],
    LJ: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "87s", "76s", "65s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "KQo", "KJo", "KTo"],
    HJ: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "JTs", "J9s", "J8s", "J7s", "T9s", "T8s", "T7s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "64s", "54s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo"],
    CO: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "JTs", "J9s", "J8s", "J7s", "J6s", "T9s", "T8s", "T7s", "T6s", "98s", "97s", "96s", "87s", "86s", "85s", "76s", "75s", "74s", "65s", "64s", "63s", "54s", "53s", "43s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o", "KQo", "KJo", "KTo", "K9o", "K8o", "QJo", "QTo", "Q9o", "JTo", "J9o", "T9o"],
    BTN: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s", "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s", "T9s", "T8s", "T7s", "T6s", "T5s", "98s", "97s", "96s", "95s", "87s", "86s", "85s", "84s", "76s", "75s", "74s", "73s", "65s", "64s", "63s", "54s", "53s", "52s", "43s", "42s", "32s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o", "KQo", "KJo", "KTo", "K9o", "K8o", "K7o", "K6o", "K5o", "QJo", "QTo", "Q9o", "Q8o", "Q7o", "JTo", "J9o", "J8o", "T9o", "T8o", "98o", "87o"],
    SB: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s", "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s", "J3s", "J2s", "T9s", "T8s", "T7s", "T6s", "T5s", "T4s", "98s", "97s", "96s", "95s", "94s", "87s", "86s", "85s", "84s", "83s", "76s", "75s", "74s", "73s", "72s", "65s", "64s", "63s", "62s", "54s", "53s", "52s", "43s", "42s", "32s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o", "KQo", "KJo", "KTo", "K9o", "K8o", "K7o", "K6o", "K5o", "K4o", "K3o", "K2o", "QJo", "QTo", "Q9o", "Q8o", "Q7o", "Q6o", "Q5o", "JTo", "J9o", "J8o", "J7o", "J6o", "T9o", "T8o", "T7o", "98o", "97o", "87o", "86o", "76o", "75o", "65o", "54o"],
    BB: [], // BB doesn't push, they call
  },

  // 5 BB
  5: {
    UTG: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "AKs", "AQs", "AJs", "ATs", "A9s", "KQs", "AKo", "AQo"],
    UTG1: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "KQs", "KJs", "AKo", "AQo", "AJo"],
    UTG2: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "KQs", "KJs", "KTs", "QJs", "AKo", "AQo", "AJo", "ATo", "KQo"],
    LJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "JTs", "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo"],
    HJ: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "98s", "87s", "76s", "65s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "KQo", "KJo", "KTo", "QJo"],
    CO: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "54s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo", "JTo"],
    BTN: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "JTs", "J9s", "J8s", "J7s", "J6s", "T9s", "T8s", "T7s", "T6s", "98s", "97s", "96s", "87s", "86s", "85s", "76s", "75s", "74s", "65s", "64s", "54s", "53s", "43s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o", "KQo", "KJo", "KTo", "K9o", "K8o", "K7o", "QJo", "QTo", "Q9o", "Q8o", "JTo", "J9o", "T9o", "98o"],
    SB: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "T9s", "T8s", "T7s", "T6s", "98s", "97s", "96s", "87s", "86s", "85s", "76s", "75s", "74s", "65s", "64s", "63s", "54s", "53s", "43s", "42s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "A2o", "KQo", "KJo", "KTo", "K9o", "K8o", "K7o", "K6o", "K5o", "QJo", "QTo", "Q9o", "Q8o", "Q7o", "JTo", "J9o", "J8o", "T9o", "T8o", "98o", "87o", "76o"],
    BB: [],
  },

  // 8 BB
  8: {
    UTG: ["AA", "KK", "QQ", "JJ", "TT", "99", "AKs", "AQs", "AJs", "AKo"],
    UTG1: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "ATs", "KQs", "AKo", "AQo"],
    UTG2: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "AKs", "AQs", "AJs", "ATs", "A9s", "KQs", "KJs", "AKo", "AQo", "AJo"],
    LJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "KQs", "KJs", "KTs", "QJs", "JTs", "AKo", "AQo", "AJo", "ATo", "KQo"],
    HJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s", "65s", "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo"],
    CO: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "T8s", "98s", "97s", "87s", "76s", "65s", "54s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "KQo", "KJo", "KTo", "QJo", "QTo"],
    BTN: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "JTs", "J9s", "J8s", "J7s", "T9s", "T8s", "T7s", "98s", "97s", "96s", "87s", "86s", "76s", "75s", "65s", "64s", "54s", "53s", "43s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "KQo", "KJo", "KTo", "K9o", "K8o", "QJo", "QTo", "Q9o", "JTo", "J9o", "T9o"],
    SB: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "JTs", "J9s", "J8s", "J7s", "J6s", "T9s", "T8s", "T7s", "98s", "97s", "96s", "87s", "86s", "85s", "76s", "75s", "65s", "64s", "54s", "53s", "43s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "A3o", "KQo", "KJo", "KTo", "K9o", "K8o", "K7o", "QJo", "QTo", "Q9o", "Q8o", "JTo", "J9o", "T9o", "98o", "87o"],
    BB: [],
  },

  // 10 BB
  10: {
    UTG: ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AKo"],
    UTG1: ["AA", "KK", "QQ", "JJ", "TT", "99", "AKs", "AQs", "AJs", "AKo", "AQo"],
    UTG2: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "ATs", "KQs", "AKo", "AQo"],
    LJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "AKs", "AQs", "AJs", "ATs", "A9s", "A5s", "KQs", "KJs", "QJs", "AKo", "AQo", "AJo", "KQo"],
    HJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "AKo", "AQo", "AJo", "ATo", "KQo", "KJo"],
    CO: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "98s", "87s", "76s", "65s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "KQo", "KJo", "KTo", "QJo"],
    BTN: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "54s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo", "JTo"],
    SB: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "JTs", "J9s", "J8s", "J7s", "T9s", "T8s", "T7s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "64s", "54s", "53s", "43s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "A4o", "KQo", "KJo", "KTo", "K9o", "K8o", "QJo", "QTo", "Q9o", "JTo", "J9o", "T9o"],
    BB: [],
  },

  // 12 BB
  12: {
    UTG: ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AKo"],
    UTG1: ["AA", "KK", "QQ", "JJ", "TT", "99", "AKs", "AQs", "AKo"],
    UTG2: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "KQs", "AKo", "AQo"],
    LJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "AKs", "AQs", "AJs", "ATs", "A5s", "KQs", "KJs", "AKo", "AQo", "AJo"],
    HJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "AKs", "AQs", "AJs", "ATs", "A9s", "A5s", "A4s", "KQs", "KJs", "KTs", "QJs", "JTs", "AKo", "AQo", "AJo", "ATo", "KQo"],
    CO: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s", "65s", "AKo", "AQo", "AJo", "ATo", "A9o", "KQo", "KJo", "KTo"],
    BTN: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "65s", "54s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A5o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo", "JTo"],
    SB: [...ALL_PAIRS, "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "54s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo", "JTo", "T9o"],
    BB: [],
  },

  // 15 BB
  15: {
    UTG: ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AKo"],
    UTG1: ["AA", "KK", "QQ", "JJ", "TT", "AKs", "AQs", "AKo"],
    UTG2: ["AA", "KK", "QQ", "JJ", "TT", "99", "AKs", "AQs", "AJs", "AKo", "AQo"],
    LJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "AKs", "AQs", "AJs", "ATs", "KQs", "AKo", "AQo", "AJo"],
    HJ: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "AKs", "AQs", "AJs", "ATs", "A5s", "KQs", "KJs", "QJs", "AKo", "AQo", "AJo", "KQo"],
    CO: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A5s", "A4s", "KQs", "KJs", "KTs", "QJs", "QTs", "JTs", "T9s", "98s", "87s", "76s", "AKo", "AQo", "AJo", "ATo", "KQo", "KJo"],
    BTN: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "QJs", "QTs", "Q9s", "JTs", "J9s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "65s", "54s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo"],
    SB: ["AA", "KK", "QQ", "JJ", "TT", "99", "88", "77", "66", "55", "44", "33", "22", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "QJs", "QTs", "Q9s", "Q8s", "JTs", "J9s", "J8s", "T9s", "T8s", "98s", "97s", "87s", "86s", "76s", "75s", "65s", "54s", "AKo", "AQo", "AJo", "ATo", "A9o", "A8o", "A7o", "A6o", "A5o", "KQo", "KJo", "KTo", "K9o", "QJo", "QTo", "JTo"],
    BB: [],
  },
};

export const STACK_SIZES = [3, 5, 8, 10, 12, 15];

export function getPushRange(stackSize: number, position: Position): string[] {
  // Find closest stack size
  const closest = STACK_SIZES.reduce((prev, curr) =>
    Math.abs(curr - stackSize) < Math.abs(prev - stackSize) ? curr : prev
  );
  return PUSH_RANGES[closest]?.[position] || [];
}
