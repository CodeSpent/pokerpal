/**
 * Blind Structures for Tournaments
 */

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
}

export interface BlindStructure {
  name: string;
  levels: BlindLevel[];
}

/**
 * Standard SNG structure - good for home games
 */
export const STANDARD_SNG_STRUCTURE: BlindStructure = {
  name: 'Standard SNG',
  levels: [
    { level: 1, smallBlind: 10, bigBlind: 20, ante: 0, durationMinutes: 10 },
    { level: 2, smallBlind: 15, bigBlind: 30, ante: 0, durationMinutes: 10 },
    { level: 3, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 10 },
    { level: 4, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 10 },
    { level: 5, smallBlind: 75, bigBlind: 150, ante: 0, durationMinutes: 10 },
    { level: 6, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 10 },
    { level: 7, smallBlind: 150, bigBlind: 300, ante: 25, durationMinutes: 10 },
    { level: 8, smallBlind: 200, bigBlind: 400, ante: 50, durationMinutes: 10 },
    { level: 9, smallBlind: 300, bigBlind: 600, ante: 75, durationMinutes: 10 },
    { level: 10, smallBlind: 400, bigBlind: 800, ante: 100, durationMinutes: 10 },
    { level: 11, smallBlind: 500, bigBlind: 1000, ante: 100, durationMinutes: 10 },
    { level: 12, smallBlind: 600, bigBlind: 1200, ante: 150, durationMinutes: 10 },
    { level: 13, smallBlind: 800, bigBlind: 1600, ante: 200, durationMinutes: 10 },
    { level: 14, smallBlind: 1000, bigBlind: 2000, ante: 250, durationMinutes: 10 },
    { level: 15, smallBlind: 1500, bigBlind: 3000, ante: 300, durationMinutes: 10 },
  ],
};

/**
 * Turbo structure - faster blinds
 */
export const TURBO_STRUCTURE: BlindStructure = {
  name: 'Turbo',
  levels: [
    { level: 1, smallBlind: 15, bigBlind: 30, ante: 0, durationMinutes: 5 },
    { level: 2, smallBlind: 25, bigBlind: 50, ante: 0, durationMinutes: 5 },
    { level: 3, smallBlind: 50, bigBlind: 100, ante: 0, durationMinutes: 5 },
    { level: 4, smallBlind: 75, bigBlind: 150, ante: 0, durationMinutes: 5 },
    { level: 5, smallBlind: 100, bigBlind: 200, ante: 25, durationMinutes: 5 },
    { level: 6, smallBlind: 150, bigBlind: 300, ante: 25, durationMinutes: 5 },
    { level: 7, smallBlind: 200, bigBlind: 400, ante: 50, durationMinutes: 5 },
    { level: 8, smallBlind: 300, bigBlind: 600, ante: 50, durationMinutes: 5 },
    { level: 9, smallBlind: 400, bigBlind: 800, ante: 75, durationMinutes: 5 },
    { level: 10, smallBlind: 500, bigBlind: 1000, ante: 100, durationMinutes: 5 },
  ],
};

/**
 * Available structures
 */
export const BLIND_STRUCTURES: Record<string, BlindStructure> = {
  standard: STANDARD_SNG_STRUCTURE,
  turbo: TURBO_STRUCTURE,
};

/**
 * Get a specific blind level from a structure
 */
export function getBlindLevel(
  structure: BlindStructure,
  level: number
): BlindLevel {
  // Clamp to valid range
  const clampedLevel = Math.max(1, Math.min(level, structure.levels.length));
  return structure.levels[clampedLevel - 1];
}

/**
 * Get structure by name
 */
export function getBlindStructure(name: string): BlindStructure {
  return BLIND_STRUCTURES[name] || STANDARD_SNG_STRUCTURE;
}

/**
 * Calculate when the next level should start
 */
export function getNextLevelTime(
  levelStartedAt: number,
  currentLevel: BlindLevel
): number {
  return levelStartedAt + currentLevel.durationMinutes * 60 * 1000;
}

/**
 * Check if it's time to advance to the next level
 */
export function shouldAdvanceLevel(
  levelStartedAt: number,
  currentLevel: BlindLevel
): boolean {
  return Date.now() >= getNextLevelTime(levelStartedAt, currentLevel);
}
