/**
 * Hand History Parser Index
 *
 * Exports all parsers and provides auto-detection utility.
 */

import { ParsedHand } from "@/types/hand-history";
import { parsePokerStarsHand, parsePokerStarsFile } from "./pokerstars";
import { parseGGPokerHand, parseGGPokerFile } from "./ggpoker";

export { parsePokerStarsHand, parsePokerStarsFile } from "./pokerstars";
export { parseGGPokerHand, parseGGPokerFile } from "./ggpoker";

export type HandHistorySource = "pokerstars" | "ggpoker" | "manual" | "unknown";

/**
 * Detect the source of a hand history text
 */
export function detectSource(text: string): HandHistorySource {
  const firstLine = text.trim().split("\n")[0].toLowerCase();

  if (firstLine.includes("pokerstars")) {
    return "pokerstars";
  }
  if (firstLine.includes("poker hand") || firstLine.includes("ggpoker")) {
    return "ggpoker";
  }

  return "unknown";
}

/**
 * Auto-detect and parse a single hand
 */
export function parseHand(text: string): ParsedHand | null {
  const source = detectSource(text);

  switch (source) {
    case "pokerstars":
      return parsePokerStarsHand(text);
    case "ggpoker":
      return parseGGPokerHand(text);
    default:
      // Try both parsers
      const psHand = parsePokerStarsHand(text);
      if (psHand) return psHand;

      const ggHand = parseGGPokerHand(text);
      if (ggHand) return ggHand;

      return null;
  }
}

/**
 * Auto-detect and parse multiple hands from file content
 */
export function parseHandHistoryFile(fileContent: string): ParsedHand[] {
  const source = detectSource(fileContent);

  switch (source) {
    case "pokerstars":
      return parsePokerStarsFile(fileContent);
    case "ggpoker":
      return parseGGPokerFile(fileContent);
    default:
      // Try both parsers
      const psHands = parsePokerStarsFile(fileContent);
      if (psHands.length > 0) return psHands;

      const ggHands = parseGGPokerFile(fileContent);
      if (ggHands.length > 0) return ggHands;

      return [];
  }
}

/**
 * Get human-readable source name
 */
export function getSourceName(source: HandHistorySource): string {
  switch (source) {
    case "pokerstars":
      return "PokerStars";
    case "ggpoker":
      return "GGPoker";
    case "manual":
      return "Sample";
    default:
      return "Unknown";
  }
}
