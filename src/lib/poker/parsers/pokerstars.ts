/**
 * PokerStars Hand History Parser
 *
 * Parses hand histories exported from PokerStars into a common format.
 */

import { ParsedHand, HandPlayer, HandHistoryAction, Street } from "@/types/hand-history";
import { Position, Action } from "@/types/poker";

// Example PokerStars hand:
// PokerStars Hand #123456789: Hold'em No Limit ($0.50/$1.00 USD) - 2024/01/15 20:30:00 ET
// Table 'TableName' 6-max Seat #3 is the button
// Seat 1: Player1 ($100.00 in chips)
// Seat 2: Player2 ($85.50 in chips)
// ...
// Player1: posts small blind $0.50
// Player2: posts big blind $1.00
// *** HOLE CARDS ***
// Dealt to Hero [Ah Kd]
// Player3: folds
// Hero: raises $2.50 to $3.00
// ...
// *** FLOP *** [Jh 8c 3d]
// ...
// *** SUMMARY ***

interface SeatInfo {
  seat: number;
  name: string;
  chips: number;
}

export function parsePokerStarsHand(handText: string): ParsedHand | null {
  try {
    const lines = handText.trim().split("\n").map((l) => l.trim());

    if (!lines[0]?.includes("PokerStars")) {
      return null;
    }

    // Parse header
    const headerMatch = lines[0].match(
      /PokerStars (?:Zoom )?Hand #(\d+).*?(?:\$|€)?(\d+\.?\d*)\/(?:\$|€)?(\d+\.?\d*)/
    );
    if (!headerMatch) return null;

    const handId = headerMatch[1];
    const sbAmount = parseFloat(headerMatch[2]);
    const bbAmount = parseFloat(headerMatch[3]);

    // Determine game type
    const isTournament = lines[0].includes("Tournament") || lines[0].includes("Sit & Go");
    const gameType = isTournament ? "tournament" : "cash";

    // Parse table info
    const tableMatch = lines.find((l) => l.startsWith("Table"))?.match(
      /Table '([^']+)'.*?(\d+)-max.*?Seat #(\d+)/
    );
    const tableName = tableMatch?.[1] || "Unknown";
    const tableSize = tableMatch ? parseInt(tableMatch[2]) : 6;
    const buttonSeat = tableMatch ? parseInt(tableMatch[3]) : 1;

    // Parse seats
    const seats: SeatInfo[] = [];
    const seatRegex = /Seat (\d+): ([^\s]+) \((?:\$|€)?(\d+\.?\d*)/;

    for (const line of lines) {
      const seatMatch = line.match(seatRegex);
      if (seatMatch) {
        seats.push({
          seat: parseInt(seatMatch[1]),
          name: seatMatch[2],
          chips: parseFloat(seatMatch[3]) / bbAmount, // Convert to BB
        });
      }
    }

    // Map seats to positions
    const players: HandPlayer[] = mapSeatsToPositions(seats, buttonSeat, tableSize, bbAmount);

    // Find hero
    const heroMatch = lines.find((l) => l.includes("Dealt to"))?.match(/Dealt to ([^\s]+) \[([^\]]+)\]/);
    let heroName: string | undefined;

    if (heroMatch) {
      heroName = heroMatch[1];
      const heroCards = parseCards(heroMatch[2]);
      const heroPlayer = players.find((p) => p.name === heroName);
      if (heroPlayer && heroCards.length === 2) {
        heroPlayer.cards = heroCards as [string, string];
        heroPlayer.isHero = true;
      }
    }

    // Parse streets
    const streets: Street[] = [];
    let currentStreet: Street | null = null;
    const board: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect street markers
      if (line.includes("*** HOLE CARDS ***")) {
        currentStreet = { name: "preflop", actions: [], pot: sbAmount + bbAmount };
        streets.push(currentStreet);
      } else if (line.includes("*** FLOP ***")) {
        const flopCards = parseCardsFromBrackets(line);
        board.push(...flopCards);
        const prevPot = calculatePotFromStreet(streets[streets.length - 1], sbAmount + bbAmount);
        currentStreet = { name: "flop", cards: flopCards, actions: [], pot: prevPot };
        streets.push(currentStreet);
      } else if (line.includes("*** TURN ***")) {
        const turnCard = parseCardsFromBrackets(line);
        if (turnCard.length > 0) board.push(turnCard[turnCard.length - 1]);
        const prevPot = calculatePotFromStreet(streets[streets.length - 1], streets[streets.length - 1]?.pot || 0);
        currentStreet = { name: "turn", cards: [turnCard[turnCard.length - 1]], actions: [], pot: prevPot };
        streets.push(currentStreet);
      } else if (line.includes("*** RIVER ***")) {
        const riverCard = parseCardsFromBrackets(line);
        if (riverCard.length > 0) board.push(riverCard[riverCard.length - 1]);
        const prevPot = calculatePotFromStreet(streets[streets.length - 1], streets[streets.length - 1]?.pot || 0);
        currentStreet = { name: "river", cards: [riverCard[riverCard.length - 1]], actions: [], pot: prevPot };
        streets.push(currentStreet);
      } else if (line.includes("*** SUMMARY ***") || line.includes("*** SHOW DOWN ***")) {
        currentStreet = null;
      }

      // Parse actions
      if (currentStreet) {
        const action = parsePokerStarsAction(line, players, bbAmount);
        if (action) {
          currentStreet.actions.push(action);
        }
      }
    }

    // Parse winners
    const winners: { player: string; amount: number; hand?: string }[] = [];
    for (const line of lines) {
      const winMatch = line.match(/([^\s]+) collected (?:\$|€)?(\d+\.?\d*)/);
      if (winMatch) {
        winners.push({
          player: winMatch[1],
          amount: parseFloat(winMatch[2]) / bbAmount,
        });
      }
    }

    // Check for showdown
    const showdown = handText.includes("*** SHOW DOWN ***");

    // Calculate final pot
    const potSize = winners.reduce((sum, w) => sum + w.amount, 0) || calculateTotalPot(streets);

    return {
      id: `ps-${handId}`,
      source: "pokerstars",
      timestamp: Date.now(),
      gameType,
      stakes: `$${sbAmount}/$${bbAmount}`,
      blinds: { sb: sbAmount / bbAmount, bb: 1 },
      tableName,
      players,
      heroName,
      buttonPosition: players.find((p) => seats.find((s) => s.name === p.name)?.seat === buttonSeat)?.position || "BTN",
      streets,
      board,
      winners,
      showdown,
      potSize,
    };
  } catch (error) {
    console.error("Failed to parse PokerStars hand:", error);
    return null;
  }
}

function parseCards(cardString: string): string[] {
  // Parse "Ah Kd" or "AhKd" format
  const cards: string[] = [];
  const matches = cardString.match(/([AKQJT2-9])([hdcs])/gi);
  if (matches) {
    for (const match of matches) {
      cards.push(match.charAt(0) + match.charAt(1).toLowerCase());
    }
  }
  return cards;
}

function parseCardsFromBrackets(line: string): string[] {
  const match = line.match(/\[([^\]]+)\]/);
  if (match) {
    return parseCards(match[1]);
  }
  return [];
}

function mapSeatsToPositions(
  seats: SeatInfo[],
  buttonSeat: number,
  tableSize: number,
  bbAmount: number
): HandPlayer[] {
  const sortedSeats = [...seats].sort((a, b) => {
    const aFromButton = (a.seat - buttonSeat + tableSize) % tableSize;
    const bFromButton = (b.seat - buttonSeat + tableSize) % tableSize;
    return aFromButton - bFromButton;
  });

  const positions: Position[] =
    seats.length <= 6
      ? ["BTN", "SB", "BB", "UTG", "HJ", "CO"]
      : ["BTN", "SB", "BB", "UTG", "UTG1", "UTG2", "LJ", "HJ", "CO"];

  return sortedSeats.map((seat, i) => ({
    name: seat.name,
    position: positions[i % positions.length],
    stack: seat.chips,
  }));
}

function parsePokerStarsAction(
  line: string,
  players: HandPlayer[],
  bbAmount: number
): HandHistoryAction | null {
  // Match patterns like "Player1: folds" or "Player1: raises $5.00 to $8.00"
  const actionRegex = /^([^:]+): (folds|checks|calls|bets|raises|all-in)(?: (?:\$|€)?(\d+\.?\d*))?(?:.* to (?:\$|€)?(\d+\.?\d*))?/i;
  const match = line.match(actionRegex);

  if (!match) return null;

  const playerName = match[1];
  const player = players.find((p) => p.name === playerName);
  if (!player) return null;

  let action: Action;
  let amount: number | undefined;
  let isAllIn = false;

  const actionStr = match[2].toLowerCase();

  switch (actionStr) {
    case "folds":
      action = "fold";
      break;
    case "checks":
      action = "check";
      break;
    case "calls":
      action = "call";
      amount = match[3] ? parseFloat(match[3]) / bbAmount : undefined;
      break;
    case "bets":
      action = "raise";
      amount = match[3] ? parseFloat(match[3]) / bbAmount : undefined;
      break;
    case "raises":
      action = "raise";
      amount = match[4] ? parseFloat(match[4]) / bbAmount : (match[3] ? parseFloat(match[3]) / bbAmount : undefined);
      break;
    case "all-in":
      action = "all-in";
      amount = match[3] ? parseFloat(match[3]) / bbAmount : undefined;
      isAllIn = true;
      break;
    default:
      return null;
  }

  // Check for all-in in the line
  if (line.toLowerCase().includes("all-in")) {
    isAllIn = true;
    if (action !== "all-in") {
      action = "all-in";
    }
  }

  return {
    player: playerName,
    position: player.position,
    action,
    amount,
    isAllIn,
  };
}

function calculatePotFromStreet(street: Street | undefined, startPot: number): number {
  if (!street) return startPot;
  let pot = startPot;
  for (const action of street.actions) {
    if (action.amount && action.action !== "fold") {
      pot += action.amount;
    }
  }
  return pot;
}

function calculateTotalPot(streets: Street[]): number {
  let pot = 0;
  for (const street of streets) {
    for (const action of street.actions) {
      if (action.amount) {
        pot += action.amount;
      }
    }
  }
  return pot;
}

/**
 * Parse multiple hands from a PokerStars hand history file
 */
export function parsePokerStarsFile(fileContent: string): ParsedHand[] {
  const hands: ParsedHand[] = [];

  // Split by hand markers
  const handTexts = fileContent.split(/(?=PokerStars (?:Zoom )?Hand #)/);

  for (const handText of handTexts) {
    if (handText.trim().length > 0) {
      const parsed = parsePokerStarsHand(handText);
      if (parsed) {
        hands.push(parsed);
      }
    }
  }

  return hands;
}
