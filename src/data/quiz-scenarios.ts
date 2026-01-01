import { Scenario } from "@/types/scenarios";

export const QUIZ_SCENARIOS: Scenario[] = [
  // ============ BEGINNER PREFLOP ============
  {
    id: "preflop-001",
    title: "Premium Pair UTG",
    description: "You're dealt pocket Aces under the gun",
    difficulty: "beginner",
    category: "preflop",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "UTG",
      heroStack: 100,
      heroCards: { card1: "Ah", card2: "As" },
      villains: [
        { position: "HJ", stack: 100 },
        { position: "CO", stack: 85 },
        { position: "BTN", stack: 120 },
        { position: "SB", stack: 95 },
        { position: "BB", stack: 100 },
      ],
      street: "preflop",
      pot: 1.5,
      actionHistory: [],
    },
    question: "You're UTG with pocket Aces. What's your action?",
    options: [
      { id: "a", action: "fold", label: "Fold" },
      { id: "b", action: "call", label: "Limp" },
      { id: "c", action: "raise", amount: 3, label: "Raise to 3 BB" },
      { id: "d", action: "raise", amount: 2, label: "Min-raise to 2 BB" },
    ],
    correctOptionId: "c",
    explanation:
      "With pocket Aces, you always want to raise for value. A standard open raise of 3 BB builds the pot and charges draws. Limping is a mistake as it lets opponents see cheap flops with speculative hands.",
    keyTakeaway: "Always raise premium pairs preflop - never limp with AA or KK.",
    tags: ["premium-pairs", "opening", "value"],
  },
  {
    id: "preflop-002",
    title: "Suited Connector on the Button",
    description: "Everyone folds to you on the button with 7♠6♠",
    difficulty: "beginner",
    category: "preflop",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "BTN",
      heroStack: 100,
      heroCards: { card1: "7s", card2: "6s" },
      villains: [
        { position: "SB", stack: 100, playerType: "tight" },
        { position: "BB", stack: 100, playerType: "tight" },
      ],
      street: "preflop",
      pot: 1.5,
      actionHistory: [
        { position: "UTG", action: "fold" },
        { position: "HJ", action: "fold" },
        { position: "CO", action: "fold" },
      ],
    },
    question: "Everyone folds to you on the button. What do you do with 7♠6♠?",
    options: [
      { id: "a", action: "fold", label: "Fold" },
      { id: "b", action: "raise", amount: 2.5, label: "Raise to 2.5 BB" },
      { id: "c", action: "call", label: "Limp" },
    ],
    correctOptionId: "b",
    explanation:
      "On the button with only the blinds left to act, 76 suited is a profitable open. You have position postflop, fold equity preflop, and a hand that can make straights and flushes. Against tight blinds, this is a clear raise.",
    keyTakeaway: "Position allows you to profitably open wider ranges - suited connectors play well on the button.",
    tags: ["suited-connectors", "button", "stealing"],
  },
  {
    id: "preflop-003",
    title: "Facing a 3-Bet with AK",
    description: "You open from CO, button 3-bets",
    difficulty: "beginner",
    category: "preflop",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "CO",
      heroStack: 100,
      heroCards: { card1: "Ac", card2: "Kd" },
      villains: [
        { position: "BTN", stack: 100 },
        { position: "SB", stack: 100 },
        { position: "BB", stack: 100 },
      ],
      street: "preflop",
      pot: 12,
      actionHistory: [
        { position: "UTG", action: "fold" },
        { position: "HJ", action: "fold" },
        { position: "CO", action: "raise", amount: 3 },
        { position: "BTN", action: "raise", amount: 9 },
        { position: "SB", action: "fold" },
        { position: "BB", action: "fold" },
      ],
      toCall: 6,
    },
    question: "You opened 3 BB from CO, BTN 3-bets to 9 BB. You have AK offsuit. What's your play?",
    options: [
      { id: "a", action: "fold", label: "Fold" },
      { id: "b", action: "call", label: "Call" },
      { id: "c", action: "raise", amount: 22, label: "4-bet to 22 BB" },
      { id: "d", action: "all-in", label: "All-in" },
    ],
    correctOptionId: "c",
    explanation:
      "AK is too strong to fold to a single 3-bet. Calling is acceptable, but 4-betting is often better as it builds the pot with a premium hand and puts pressure on villain's 3-bet bluffs. Going all-in is too aggressive at 100 BB deep.",
    keyTakeaway: "AK is a premium hand that should be 4-bet for value against most 3-betting ranges.",
    tags: ["3bet", "4bet", "premium"],
  },

  // ============ BEGINNER POT ODDS ============
  {
    id: "potodds-001",
    title: "Flush Draw on the Flop",
    description: "You have a flush draw facing a bet",
    difficulty: "beginner",
    category: "pot-odds",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "BTN",
      heroStack: 97,
      heroCards: { card1: "Ah", card2: "Th" },
      villains: [{ position: "CO", stack: 97 }],
      street: "flop",
      pot: 15,
      board: ["Kh", "7h", "2c"],
      actionHistory: [
        { position: "CO", action: "raise", amount: 3 },
        { position: "BTN", action: "call", amount: 3 },
        { position: "CO", action: "raise", amount: 5 },
      ],
      toCall: 5,
    },
    question: "Flop is K♥7♥2♣. You have A♥T♥ (nut flush draw). Villain bets 5 BB into 6 BB. What do you do?",
    options: [
      { id: "a", action: "fold", label: "Fold" },
      { id: "b", action: "call", label: "Call" },
      { id: "c", action: "raise", amount: 15, label: "Raise to 15 BB" },
    ],
    correctOptionId: "b",
    explanation:
      "You have 9 outs to the nut flush (~35% equity by the river). You're getting 11:5 pot odds (31% needed). With implied odds and the nut flush draw, calling is clearly profitable. Raising is also fine as a semi-bluff.",
    keyTakeaway: "With 9 flush outs, you have ~35% equity to hit by the river - almost always a profitable call.",
    tags: ["flush-draw", "pot-odds", "drawing"],
  },
  {
    id: "potodds-002",
    title: "Gutshot on the Turn",
    description: "You have a gutshot straight draw facing a big bet",
    difficulty: "beginner",
    category: "pot-odds",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "CO",
      heroStack: 80,
      heroCards: { card1: "Jc", card2: "Tc" },
      villains: [{ position: "UTG", stack: 85 }],
      street: "turn",
      pot: 25,
      board: ["Qh", "8s", "3d", "2c"],
      actionHistory: [
        { position: "UTG", action: "raise", amount: 20 },
      ],
      toCall: 20,
    },
    question: "Turn is Q♠8♠3♦2♣. You have J♣T♣ (gutshot to the nuts). Villain bets 20 BB into 25 BB. Call?",
    options: [
      { id: "a", action: "fold", label: "Fold" },
      { id: "b", action: "call", label: "Call" },
    ],
    correctOptionId: "a",
    explanation:
      "A gutshot has only 4 outs (~8% on the river). You need to call 20 to win 45, requiring 31% equity. With only 8%, this is a clear fold. You're not getting the right price even with implied odds.",
    keyTakeaway: "Gutshots (4 outs) are rarely worth calling large bets - you need about 4:1 odds or better.",
    tags: ["gutshot", "pot-odds", "fold"],
  },

  // ============ INTERMEDIATE VALUE BETTING ============
  {
    id: "value-001",
    title: "Top Pair Good Kicker",
    description: "You have top pair on a dry board",
    difficulty: "intermediate",
    category: "postflop-value",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "CO",
      heroStack: 94,
      heroCards: { card1: "As", card2: "Jd" },
      villains: [{ position: "BB", stack: 94 }],
      street: "flop",
      pot: 6,
      board: ["Jh", "7c", "2s"],
      actionHistory: [
        { position: "BB", action: "check" },
      ],
    },
    question: "Flop is J♥7♣2♠. You have AJ (top pair top kicker). BB checks. Your action?",
    options: [
      { id: "a", action: "check", label: "Check back" },
      { id: "b", action: "raise", amount: 3, label: "Bet 3 BB (50% pot)" },
      { id: "c", action: "raise", amount: 4.5, label: "Bet 4.5 BB (75% pot)" },
      { id: "d", action: "raise", amount: 6, label: "Bet 6 BB (pot)" },
    ],
    correctOptionId: "c",
    explanation:
      "With top pair top kicker on a dry board, you want to bet for value. 75% pot is a good sizing that gets called by worse Jx hands, pocket pairs, and draws. Checking gives free cards and misses value.",
    keyTakeaway: "Bet for value with strong made hands - don't give free cards on dry boards.",
    tags: ["value-bet", "top-pair", "dry-board"],
  },
  {
    id: "value-002",
    title: "Set on a Wet Board",
    description: "You flopped a set on a coordinated board",
    difficulty: "intermediate",
    category: "postflop-value",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "BTN",
      heroStack: 95,
      heroCards: { card1: "8h", card2: "8c" },
      villains: [{ position: "CO", stack: 97 }],
      street: "flop",
      pot: 6.5,
      board: ["8s", "9s", "Ts"],
      actionHistory: [
        { position: "CO", action: "raise", amount: 5 },
      ],
      toCall: 5,
    },
    question: "Flop is 8♠9♠T♠. You have 8♥8♣ (bottom set). Villain bets 5 BB. What do you do?",
    options: [
      { id: "a", action: "fold", label: "Fold" },
      { id: "b", action: "call", label: "Call" },
      { id: "c", action: "raise", amount: 16, label: "Raise to 16 BB" },
    ],
    correctOptionId: "c",
    explanation:
      "You have bottom set on an extremely wet board. While you're ahead of most hands, there are many draws that have significant equity. Raising protects your hand by charging draws and builds the pot while you're likely ahead. The board could easily complete straights and flushes on later streets.",
    keyTakeaway: "On wet boards with strong hands, raise to charge draws and build the pot while ahead.",
    tags: ["set", "wet-board", "protection"],
  },

  // ============ INTERMEDIATE BLUFFING ============
  {
    id: "bluff-001",
    title: "Continuation Bet Bluff",
    description: "You raised preflop and missed the flop",
    difficulty: "intermediate",
    category: "postflop-bluff",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "CO",
      heroStack: 97,
      heroCards: { card1: "Ac", card2: "Kd" },
      villains: [{ position: "BB", stack: 97, playerType: "tight" }],
      street: "flop",
      pot: 6.5,
      board: ["7h", "4c", "2s"],
      actionHistory: [
        { position: "BB", action: "check" },
      ],
    },
    question: "Flop is 7♥4♣2♠. You have AK (two overcards). BB checks. What's your play?",
    options: [
      { id: "a", action: "check", label: "Check back" },
      { id: "b", action: "raise", amount: 2, label: "Bet 2 BB (33% pot)" },
      { id: "c", action: "raise", amount: 4.5, label: "Bet 4.5 BB (75% pot)" },
    ],
    correctOptionId: "b",
    explanation:
      "A small c-bet of 33% pot is ideal here. You have two overcards (6 outs if behind), and a small bet gets folds from hands like 65, 53 without risking much. Against a tight player who didn't connect with 742, you'll often take it down.",
    keyTakeaway: "Use small c-bet sizings on dry boards where you don't need to bet big to get folds.",
    tags: ["c-bet", "bluff", "small-sizing"],
  },
  {
    id: "bluff-002",
    title: "River Bluff Opportunity",
    description: "The river completes an obvious draw",
    difficulty: "intermediate",
    category: "postflop-bluff",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "BTN",
      heroStack: 75,
      heroCards: { card1: "9c", card2: "8c" },
      villains: [{ position: "BB", stack: 80 }],
      street: "river",
      pot: 45,
      board: ["Kh", "Qs", "5c", "3d", "Th"],
      actionHistory: [
        { position: "BB", action: "check" },
      ],
    },
    question: "River is K♥Q♠5♣3♦T♥. Board now has a straight (AJ). You have 9♣8♣ (nothing). BB checks. Your action?",
    options: [
      { id: "a", action: "check", label: "Check (give up)" },
      { id: "b", action: "raise", amount: 15, label: "Bet 15 BB (33% pot)" },
      { id: "c", action: "raise", amount: 35, label: "Bet 35 BB (75% pot)" },
    ],
    correctOptionId: "c",
    explanation:
      "The river T completes AJ for a straight. You can credibly represent this straight since you could have AJ in your button range. A large bet of 75% pot tells a believable story and puts maximum pressure on villain's one-pair hands.",
    keyTakeaway: "Bluff when the board changes in a way that helps your perceived range, and size big to maximize fold equity.",
    tags: ["river-bluff", "scare-card", "big-sizing"],
  },

  // ============ ADVANCED SCENARIOS ============
  {
    id: "adv-001",
    title: "Thin Value on the River",
    description: "Deciding whether to value bet a medium-strength hand",
    difficulty: "advanced",
    category: "postflop-value",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "CO",
      heroStack: 65,
      heroCards: { card1: "Ks", card2: "Jh" },
      villains: [{ position: "BTN", stack: 70 }],
      street: "river",
      pot: 55,
      board: ["Kc", "8d", "3h", "5s", "2c"],
      actionHistory: [
        { position: "BTN", action: "check" },
      ],
    },
    question: "River is K♣8♦3♥5♠2♣. You have KJ (top pair). BTN has checked to you. What's optimal?",
    options: [
      { id: "a", action: "check", label: "Check back" },
      { id: "b", action: "raise", amount: 20, label: "Bet 20 BB (36% pot)" },
      { id: "c", action: "raise", amount: 40, label: "Bet 40 BB (73% pot)" },
    ],
    correctOptionId: "b",
    explanation:
      "This is a thin value spot. KJ is likely ahead of Kx with worse kickers and pocket pairs. A small sizing of ~1/3 pot gets called by worse hands while minimizing losses when villain has AK or a set. Checking forfeits value against hands that would call a small bet.",
    keyTakeaway: "Use small sizings for thin value bets - you want to get called by worse, not better hands.",
    tags: ["thin-value", "river", "sizing"],
  },
  {
    id: "adv-002",
    title: "Facing a Check-Raise",
    description: "You bet and get check-raised on a draw-heavy board",
    difficulty: "advanced",
    category: "postflop-bluff",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "BTN",
      heroStack: 85,
      heroCards: { card1: "Ad", card2: "Qd" },
      villains: [{ position: "BB", stack: 90 }],
      street: "flop",
      pot: 35,
      board: ["Jd", "Td", "4c"],
      actionHistory: [
        { position: "BB", action: "check" },
        { position: "BTN", action: "raise", amount: 5 },
        { position: "BB", action: "raise", amount: 18 },
      ],
      toCall: 13,
    },
    question: "Flop is J♦T♦4♣. You have A♦Q♦ (nut flush draw + gutshot). You bet 5 BB, BB check-raises to 18 BB. Action?",
    options: [
      { id: "a", action: "fold", label: "Fold" },
      { id: "b", action: "call", label: "Call" },
      { id: "c", action: "raise", amount: 45, label: "Re-raise to 45 BB" },
      { id: "d", action: "all-in", label: "All-in" },
    ],
    correctOptionId: "c",
    explanation:
      "You have the nut flush draw (9 outs) plus a gutshot to the nuts (3 more outs for K) = 12 outs (~45% equity). Against a check-raise, you can re-raise as a semi-bluff. This puts pressure on hands like JT, and you have great equity if called. Folding is too weak; calling is passive with a drawing hand this strong.",
    keyTakeaway: "With combo draws (12+ outs), you often have enough equity to semi-bluff raise and put pressure on.",
    tags: ["combo-draw", "semi-bluff", "aggression"],
  },
  {
    id: "adv-003",
    title: "Tournament Bubble Decision",
    description: "Short-stacked on the bubble facing an all-in",
    difficulty: "advanced",
    category: "tournament",
    setup: {
      tableSize: 6,
      blinds: { sb: 1, bb: 2 },
      ante: 0.25,
      heroPosition: "CO",
      heroStack: 12,
      heroCards: { card1: "As", card2: "Ts" },
      villains: [
        { position: "UTG", stack: 45 },
        { position: "BTN", stack: 35 },
        { position: "SB", stack: 8 },
        { position: "BB", stack: 25 },
      ],
      street: "preflop",
      pot: 4.5,
      actionHistory: [
        { position: "UTG", action: "fold" },
        { position: "HJ", action: "all-in", amount: 15 },
      ],
      toCall: 12,
    },
    question: "Bubble of a tournament. HJ shoves 15 BB. You have AT suited with 12 BB. SB only has 8 BB. Call?",
    options: [
      { id: "a", action: "fold", label: "Fold" },
      { id: "b", action: "all-in", label: "Call All-in" },
    ],
    correctOptionId: "a",
    explanation:
      "Despite AT suited being a strong hand, ICM changes everything on the bubble. The SB has only 8 BB and is likely to bust soon, guaranteeing you a cash. With 12 BB, you're not desperate. The HJ's shoving range from early position is likely strong (pairs, AQ+). Let shorter stacks bust first.",
    keyTakeaway: "On the bubble, survival matters more than chips. Let shorter stacks take risks while you wait to cash.",
    tags: ["icm", "bubble", "survival"],
  },

  // ============ POSITION SCENARIOS ============
  {
    id: "pos-001",
    title: "Out of Position Multiway",
    description: "Navigating a multiway pot from the blinds",
    difficulty: "intermediate",
    category: "position",
    setup: {
      tableSize: 6,
      blinds: { sb: 0.5, bb: 1 },
      heroPosition: "BB",
      heroStack: 95,
      heroCards: { card1: "Qc", card2: "Jc" },
      villains: [
        { position: "CO", stack: 100 },
        { position: "BTN", stack: 90 },
      ],
      street: "flop",
      pot: 10,
      board: ["Qh", "8d", "3c"],
      actionHistory: [],
    },
    question: "Flop is Q♥8♦3♣. You have QJ in the BB (top pair) vs CO and BTN. First to act. Your play?",
    options: [
      { id: "a", action: "check", label: "Check" },
      { id: "b", action: "raise", amount: 3, label: "Bet 3 BB (33% pot)" },
      { id: "c", action: "raise", amount: 7, label: "Bet 7 BB (70% pot)" },
    ],
    correctOptionId: "a",
    explanation:
      "Out of position in a multiway pot, checking is often best even with top pair. If you bet and get called by both, you're in a tough spot. By checking, you can call a bet, check-raise for value, or check-call multiple streets. Let in-position players define the action.",
    keyTakeaway: "In multiway pots OOP, checking strong hands protects against multiple callers and gives you options.",
    tags: ["multiway", "oop", "pot-control"],
  },
];

// Get scenarios by difficulty
export function getScenariosByDifficulty(difficulty: string): Scenario[] {
  return QUIZ_SCENARIOS.filter((s) => s.difficulty === difficulty);
}

// Get scenarios by category
export function getScenariosByCategory(category: string): Scenario[] {
  return QUIZ_SCENARIOS.filter((s) => s.category === category);
}

// Get a random scenario
export function getRandomScenario(
  options?: { difficulty?: string; category?: string; excludeIds?: string[] }
): Scenario | null {
  let filtered = [...QUIZ_SCENARIOS];

  if (options?.difficulty) {
    filtered = filtered.filter((s) => s.difficulty === options.difficulty);
  }
  if (options?.category) {
    filtered = filtered.filter((s) => s.category === options.category);
  }
  if (options?.excludeIds?.length) {
    filtered = filtered.filter((s) => !options.excludeIds!.includes(s.id));
  }

  if (filtered.length === 0) return null;

  return filtered[Math.floor(Math.random() * filtered.length)];
}
