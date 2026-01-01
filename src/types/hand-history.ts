import { Position, Action, Card } from "./poker";

// A player in the hand
export interface HandPlayer {
  name: string;
  position: Position;
  stack: number; // in BB or chips
  cards?: [string, string]; // hole cards if shown
  isHero?: boolean;
}

// A single action in the hand
export interface HandHistoryAction {
  player: string;
  position: Position;
  action: Action;
  amount?: number;
  isAllIn?: boolean;
}

// A street in the hand
export interface Street {
  name: "preflop" | "flop" | "turn" | "river";
  cards?: string[]; // community cards dealt this street
  actions: HandHistoryAction[];
  pot: number; // pot at start of street
}

// Complete parsed hand
export interface ParsedHand {
  id: string;
  source: "pokerstars" | "ggpoker" | "manual";
  timestamp: number;

  // Game info
  gameType: "cash" | "tournament" | "sng";
  stakes?: string; // e.g., "$0.50/$1.00"
  blinds: { sb: number; bb: number; ante?: number };
  tableName?: string;

  // Players
  players: HandPlayer[];
  heroName?: string;
  buttonPosition: Position;

  // The hand
  streets: Street[];
  board: string[]; // final board

  // Results
  winners: { player: string; amount: number; hand?: string }[];
  showdown: boolean;

  // Analysis
  potSize: number; // final pot
  rake?: number;
  notes?: string;
}

// Hand history store entry
export interface SavedHand extends ParsedHand {
  savedAt: number;
  tags?: string[];
  notes?: string;
  reviewed?: boolean;
}

// Replayer state
export interface ReplayerState {
  hand: ParsedHand;
  currentStreetIndex: number;
  currentActionIndex: number;
  isPlaying: boolean;
  playbackSpeed: number; // ms between actions
}

// Position labels for different table sizes
export const POSITION_ORDER_6MAX: Position[] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
export const POSITION_ORDER_9MAX: Position[] = ["UTG", "UTG1", "UTG2", "LJ", "HJ", "CO", "BTN", "SB", "BB"];

// Get position from seat number
export function getPositionFromSeat(
  seatNumber: number,
  buttonSeat: number,
  totalSeats: number,
  occupiedSeats: number[]
): Position {
  const positions = totalSeats <= 6 ? POSITION_ORDER_6MAX : POSITION_ORDER_9MAX;

  // Find how many seats after button this seat is
  const seatsFromButton = (seatNumber - buttonSeat + totalSeats) % totalSeats;

  // Map to position based on occupied seats
  const activeSeats = occupiedSeats.sort((a, b) => {
    const aFromButton = (a - buttonSeat + totalSeats) % totalSeats;
    const bFromButton = (b - buttonSeat + totalSeats) % totalSeats;
    return aFromButton - bFromButton;
  });

  const positionIndex = activeSeats.indexOf(seatNumber);

  // BTN is always first after sorting, SB second, BB third, then others
  if (positionIndex === 0) return "BTN";
  if (positionIndex === 1) return "SB";
  if (positionIndex === 2) return "BB";

  // Remaining positions depend on table size
  const remainingPositions = positions.filter(p => !["BTN", "SB", "BB"].includes(p));
  const adjustedIndex = activeSeats.length - 1 - positionIndex;

  return remainingPositions[Math.min(adjustedIndex, remainingPositions.length - 1)] || "UTG";
}
