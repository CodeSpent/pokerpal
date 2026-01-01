/**
 * GGPoker Hand History Parser
 *
 * Parses hand histories exported from GGPoker into a common format.
 * GGPoker uses a similar format to PokerStars but with some differences.
 */

import { ParsedHand, HandPlayer, HandHistoryAction, Street } from "@/types/hand-history";
import { Position, Action } from "@/types/poker";

// Example GGPoker hand format:
// Poker Hand #HD123456789: Tournament #1234567, $5.00+$0.50 USD Hold'em No Limit - Level I (10/20) - 2024/01/15 20:30:00
// Table '1234567 1' 6-max Seat #3 is the button
// Seat 1: Player1 (1500 in chips)
// Seat 2: Player2 (1450 in chips)
// ...

interface SeatInfo {
  seat: number;
  name: string;
  chips: number;
}

export function parseGGPokerHand(handText: string): ParsedHand | null {
  try {
    const lines = handText.trim().split("\n").map((l) => l.trim());

    // GGPoker hands can start with "Poker Hand" or sometimes have GG branding
    const headerLine = lines[0];
    if (!headerLine.includes("Poker Hand") && !headerLine.includes("GGPoker")) {
      return null;
    }

    // Parse hand ID
    const handIdMatch = headerLine.match(/Hand #(?:HD)?(\d+)/i);
    const handId = handIdMatch ? handIdMatch[1] : crypto.randomUUID();

    // Detect tournament vs cash
    const isTournament = headerLine.includes("Tournament");
    const gameType = isTournament ? "tournament" : "cash";

    // Parse blinds - different format for tournament vs cash
    let sbAmount = 0.5;
    let bbAmount = 1;
    let ante: number | undefined;

    if (isTournament) {
      // Tournament format: Level I (10/20) or Level 5 (25/50/5)
      const levelMatch = headerLine.match(/Level [IVX\d]+ \((\d+)\/(\d+)(?:\/(\d+))?\)/);
      if (levelMatch) {
        sbAmount = parseInt(levelMatch[1]);
        bbAmount = parseInt(levelMatch[2]);
        if (levelMatch[3]) {
          ante = parseInt(levelMatch[3]);
        }
      }
    } else {
      // Cash format: $0.05/$0.10 USD
      const blindsMatch = headerLine.match(/\$(\d+\.?\d*)\/\$(\d+\.?\d*)/);
      if (blindsMatch) {
        sbAmount = parseFloat(blindsMatch[1]);
        bbAmount = parseFloat(blindsMatch[2]);
      }
    }

    // Parse table info
    const tableMatch = lines.find((l) => l.startsWith("Table"))?.match(
      /Table '([^']+)'.*?(\d+)-max.*?Seat #(\d+)/
    );
    const tableName = tableMatch?.[1] || "GGPoker";
    const tableSize = tableMatch ? parseInt(tableMatch[2]) : 6;
    const buttonSeat = tableMatch ? parseInt(tableMatch[3]) : 1;

    // Parse seats
    const seats: SeatInfo[] = [];
    const seatRegex = /Seat (\d+): ([^\s(]+)(?: \([^)]+\))? \((\d+\.?\d*)/;

    for (const line of lines) {
      const seatMatch = line.match(seatRegex);
      if (seatMatch) {
        const chips = parseFloat(seatMatch[3]);
        seats.push({
          seat: parseInt(seatMatch[1]),
          name: seatMatch[2],
          chips: isTournament ? chips / bbAmount : chips / bbAmount, // Convert to BB
        });
      }
    }

    // Map seats to positions
    const players: HandPlayer[] = mapSeatsToPositions(seats, buttonSeat, tableSize);

    // Find hero - GGPoker uses "Dealt to Hero" format
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
    let runningPot = sbAmount / bbAmount + 1; // SB + BB in BB

    if (ante) {
      runningPot += (ante / bbAmount) * players.length;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect street markers
      if (line.includes("*** HOLE CARDS ***") || line.includes("*** HOLECARDS ***")) {
        currentStreet = { name: "preflop", actions: [], pot: runningPot };
        streets.push(currentStreet);
      } else if (line.includes("*** FLOP ***")) {
        const flopCards = parseCardsFromBrackets(line);
        board.push(...flopCards);
        runningPot = calculatePotFromStreet(streets[streets.length - 1], runningPot);
        currentStreet = { name: "flop", cards: flopCards, actions: [], pot: runningPot };
        streets.push(currentStreet);
      } else if (line.includes("*** TURN ***")) {
        const allCards = parseCardsFromBrackets(line);
        const turnCard = allCards[allCards.length - 1];
        if (turnCard) board.push(turnCard);
        runningPot = calculatePotFromStreet(streets[streets.length - 1], runningPot);
        currentStreet = { name: "turn", cards: turnCard ? [turnCard] : [], actions: [], pot: runningPot };
        streets.push(currentStreet);
      } else if (line.includes("*** RIVER ***")) {
        const allCards = parseCardsFromBrackets(line);
        const riverCard = allCards[allCards.length - 1];
        if (riverCard) board.push(riverCard);
        runningPot = calculatePotFromStreet(streets[streets.length - 1], runningPot);
        currentStreet = { name: "river", cards: riverCard ? [riverCard] : [], actions: [], pot: runningPot };
        streets.push(currentStreet);
      } else if (line.includes("*** SUMMARY ***") || line.includes("*** SHOWDOWN ***")) {
        currentStreet = null;
      }

      // Parse actions
      if (currentStreet) {
        const action = parseGGPokerAction(line, players, bbAmount, isTournament);
        if (action) {
          currentStreet.actions.push(action);
        }
      }
    }

    // Parse winners
    const winners: { player: string; amount: number; hand?: string }[] = [];
    for (const line of lines) {
      // GGPoker: "Player1 collected 1234 from pot"
      const winMatch = line.match(/([^\s]+) collected (\d+\.?\d*)/);
      if (winMatch) {
        const amount = parseFloat(winMatch[2]);
        winners.push({
          player: winMatch[1],
          amount: amount / bbAmount,
        });
      }
    }

    // Check for showdown
    const showdown = handText.includes("*** SHOWDOWN ***") || handText.includes("*** SHOW DOWN ***");

    // Parse shown hands
    for (const line of lines) {
      const showMatch = line.match(/([^\s]+): shows \[([^\]]+)\]/);
      if (showMatch) {
        const player = players.find((p) => p.name === showMatch[1]);
        if (player) {
          const cards = parseCards(showMatch[2]);
          if (cards.length === 2) {
            player.cards = cards as [string, string];
          }
        }
      }
    }

    // Calculate final pot
    const potSize = winners.reduce((sum, w) => sum + w.amount, 0) || calculateTotalPot(streets);

    const stakes = isTournament ? `${sbAmount}/${bbAmount}` : `$${sbAmount}/$${bbAmount}`;

    return {
      id: `gg-${handId}`,
      source: "ggpoker",
      timestamp: Date.now(),
      gameType,
      stakes,
      blinds: { sb: sbAmount / bbAmount, bb: 1, ante: ante ? ante / bbAmount : undefined },
      tableName,
      players,
      heroName,
      buttonPosition: players.find((p) =>
        seats.find((s) => s.name === p.name)?.seat === buttonSeat
      )?.position || "BTN",
      streets,
      board,
      winners,
      showdown,
      potSize,
    };
  } catch (error) {
    console.error("Failed to parse GGPoker hand:", error);
    return null;
  }
}

function parseCards(cardString: string): string[] {
  const cards: string[] = [];
  // Handle both "Ah Kd" and "AhKd" formats
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
  tableSize: number
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

function parseGGPokerAction(
  line: string,
  players: HandPlayer[],
  bbAmount: number,
  isTournament: boolean
): HandHistoryAction | null {
  // Match patterns like "Player1: folds" or "Player1: raises 500 to 1000"
  const actionRegex = /^([^:]+): (folds|checks|calls|bets|raises)(?: (\d+\.?\d*))?(?:.* to (\d+\.?\d*))?/i;
  const match = line.match(actionRegex);

  if (!match) return null;

  const playerName = match[1];
  const player = players.find((p) => p.name === playerName);
  if (!player) return null;

  let action: Action;
  let amount: number | undefined;
  let isAllIn = false;

  const actionStr = match[2].toLowerCase();

  // For tournaments, amounts are in chips; for cash, they might have currency symbols
  const parseAmount = (amtStr: string | undefined): number | undefined => {
    if (!amtStr) return undefined;
    const numericValue = parseFloat(amtStr.replace(/[^\d.]/g, ""));
    return numericValue / bbAmount;
  };

  switch (actionStr) {
    case "folds":
      action = "fold";
      break;
    case "checks":
      action = "check";
      break;
    case "calls":
      action = "call";
      amount = parseAmount(match[3]);
      break;
    case "bets":
      action = "raise";
      amount = parseAmount(match[3]);
      break;
    case "raises":
      action = "raise";
      // For raises, use the "to" amount if available
      amount = match[4] ? parseAmount(match[4]) : parseAmount(match[3]);
      break;
    default:
      return null;
  }

  // Check for all-in indicator
  if (line.toLowerCase().includes("all-in") || line.toLowerCase().includes("allin")) {
    isAllIn = true;
    action = "all-in";
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
 * Parse multiple hands from a GGPoker hand history file
 */
export function parseGGPokerFile(fileContent: string): ParsedHand[] {
  const hands: ParsedHand[] = [];

  // Split by hand markers
  const handTexts = fileContent.split(/(?=Poker Hand #)/);

  for (const handText of handTexts) {
    if (handText.trim().length > 0) {
      const parsed = parseGGPokerHand(handText);
      if (parsed) {
        hands.push(parsed);
      }
    }
  }

  return hands;
}
