/**
 * Multiplayer Poker Game Simulation Test
 *
 * This script simulates a full poker game between multiple players
 * by calling the API endpoints directly. It helps test:
 * - State synchronization
 * - Turn order correctness
 * - Pot calculations
 * - Phase transitions
 * - Showdown handling
 *
 * Usage: npx tsx scripts/test-game.ts
 */

import { getDb } from '../src/lib/db';
import { generateId, now } from '../src/lib/db/transaction';
import { tables, tablePlayers, hands, players, tournaments } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  startNewHand,
  submitAction,
  advanceGameState,
  getValidActions,
  type ActionType,
} from '../src/lib/game/game-service';

// Test configuration
const NUM_PLAYERS = 4;
const STARTING_STACK = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

interface TestPlayer {
  id: string;
  name: string;
  seatIndex: number;
}

interface GameState {
  tableId: string;
  tournamentId: string;
  players: TestPlayer[];
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

function logAction(player: string, action: string, amount?: number) {
  const amountStr = amount !== undefined ? ` $${amount}` : '';
  log(`  → ${player}: ${action}${amountStr}`, colors.cyan);
}

async function setupGame(): Promise<GameState> {
  const db = getDb();

  log('\n=== Setting up test game ===\n', colors.bright);

  // Create creator player first (required for tournament)
  const creatorId = generateId();
  await db.insert(players).values({
    id: creatorId,
    name: 'Tournament Creator',
    createdAt: now(),
  });
  logSuccess(`Created tournament creator: ${creatorId}`);

  // Create tournament
  const tournamentId = generateId();
  await db.insert(tournaments).values({
    id: tournamentId,
    name: 'Test Tournament',
    status: 'running',
    creatorId,
    maxPlayers: NUM_PLAYERS,
    tableSize: 6,
    startingChips: STARTING_STACK,
    blindLevelMinutes: 10,
    turnTimerSeconds: null, // Unlimited for testing
    currentLevel: 1,
    playersRemaining: NUM_PLAYERS,
    prizePool: 0,
    createdAt: now(),
    startedAt: now(),
  });
  logSuccess(`Created tournament: ${tournamentId}`);

  // Create table
  const tableId = generateId();
  await db.insert(tables).values({
    id: tableId,
    tournamentId,
    tableNumber: 1,
    maxSeats: 6,
    status: 'active',
    smallBlind: SMALL_BLIND,
    bigBlind: BIG_BLIND,
    ante: 0,
    dealerSeat: 0,
    version: 1,
    createdAt: now(),
  });
  logSuccess(`Created table: ${tableId}`);

  // Create and seat players
  const testPlayers: TestPlayer[] = [];
  for (let i = 0; i < NUM_PLAYERS; i++) {
    const playerId = generateId();
    const name = `Player ${i + 1}`;

    await db.insert(players).values({
      id: playerId,
      name,
      createdAt: now(),
    });

    await db.insert(tablePlayers).values({
      id: generateId(),
      tableId,
      playerId,
      seatIndex: i,
      stack: STARTING_STACK,
      status: 'waiting',
      currentBet: 0,
    });

    testPlayers.push({ id: playerId, name, seatIndex: i });
    logSuccess(`Seated ${name} at seat ${i} with $${STARTING_STACK}`);
  }

  return { tableId, tournamentId, players: testPlayers };
}

async function getTableState(tableId: string) {
  const db = getDb();

  const [table] = await db.select().from(tables).where(eq(tables.id, tableId));
  const playerList = await db.select().from(tablePlayers).where(eq(tablePlayers.tableId, tableId));
  const [hand] = await db
    .select()
    .from(hands)
    .where(and(eq(hands.tableId, tableId)))
    .orderBy(hands.handNumber);

  return { table, players: playerList, hand };
}

async function printTableState(tableId: string, title: string) {
  const { table, players, hand } = await getTableState(tableId);

  log(`\n--- ${title} ---`, colors.yellow);

  if (hand) {
    log(`  Hand #${hand.handNumber} | Phase: ${hand.phase} | Pot: $${hand.pot}`);
    log(`  Current bet: $${hand.currentBet} | Actor seat: ${hand.currentActorSeat}`);
    log(`  Dealer: seat ${hand.dealerSeat} | SB: seat ${hand.smallBlindSeat} | BB: seat ${hand.bigBlindSeat}`);

    const cc = hand.communityCards ? JSON.parse(hand.communityCards) : [];
    if (cc.length > 0) {
      log(`  Community cards: ${cc.join(' ')}`);
    }
  } else {
    log(`  No active hand`);
  }

  log(`  Players:`);
  for (const p of players.sort((a, b) => a.seatIndex - b.seatIndex)) {
    const cards = p.holeCard1 && p.holeCard2 ? `[${p.holeCard1} ${p.holeCard2}]` : '[ - - ]';
    const isActor = hand?.currentActorSeat === p.seatIndex ? ' ←' : '';
    log(`    Seat ${p.seatIndex}: $${p.stack.toString().padStart(4)} | bet: $${p.currentBet.toString().padStart(3)} | ${p.status.padEnd(8)} ${cards}${isActor}`);
  }
}

async function simulateAction(
  tableId: string,
  playerId: string,
  playerName: string,
  action: ActionType,
  amount?: number
): Promise<boolean> {
  const result = await submitAction({
    tableId,
    playerId,
    action,
    amount,
  });

  if (result.success) {
    logAction(playerName, action, amount);
    return true;
  } else {
    logError(`${playerName} failed to ${action}: ${result.error}`);
    return false;
  }
}

async function getPlayerValidActions(tableId: string, playerId: string) {
  const { table, players, hand } = await getTableState(tableId);
  if (!hand) return null;

  const player = players.find(p => p.playerId === playerId);
  if (!player) return null;

  const toCall = Math.max(0, hand.currentBet - player.currentBet);

  return getValidActions({
    status: player.status,
    currentBet: hand.currentBet,
    playerBet: player.currentBet,
    playerStack: player.stack,
    minRaise: hand.minRaise,
    bigBlind: BIG_BLIND,
    canCheck: toCall === 0,
  });
}

async function playHand(gameState: GameState, handNum: number) {
  const { tableId, players } = gameState;
  const db = getDb();

  log(`\n${'='.repeat(50)}`, colors.bright);
  log(`HAND #${handNum}`, colors.bright);
  log(`${'='.repeat(50)}`, colors.bright);

  // Start hand
  const hand = await startNewHand(tableId, handNum);
  logSuccess(`Started hand #${handNum}`);

  await printTableState(tableId, 'After deal');

  // Play the hand
  let handComplete = false;
  let iterations = 0;
  const MAX_ITERATIONS = 50; // Safety limit

  while (!handComplete && iterations < MAX_ITERATIONS) {
    iterations++;

    // Get current state
    const state = await getTableState(tableId);
    if (!state.hand || state.hand.phase === 'complete' || state.hand.phase === 'showdown') {
      handComplete = true;
      break;
    }

    const currentActorSeat = state.hand.currentActorSeat;
    if (currentActorSeat === null || currentActorSeat === undefined) {
      // No actor - might need to advance
      const advance = await advanceGameState(tableId);
      if (advance.newHandStarted || advance.showdownCompleted) {
        handComplete = true;
      }
      continue;
    }

    // Find current actor
    const actorPlayer = state.players.find(p => p.seatIndex === currentActorSeat);
    if (!actorPlayer) {
      logError(`Actor at seat ${currentActorSeat} not found!`);
      break;
    }

    const testPlayer = players.find(p => p.id === actorPlayer.playerId);
    if (!testPlayer) {
      logError(`Test player not found for ${actorPlayer.playerId}`);
      break;
    }

    // Get valid actions
    const valid = await getPlayerValidActions(tableId, actorPlayer.playerId);
    if (!valid) {
      logError(`Could not get valid actions for ${testPlayer.name}`);
      break;
    }

    // Decide action based on simple strategy
    // Fold 20%, check if can, call if can, raise 20%
    const roll = Math.random();
    let action: ActionType;
    let amount: number | undefined;

    if (roll < 0.1 && valid.canFold) {
      action = 'fold';
    } else if (valid.canCheck) {
      if (roll < 0.3 && valid.canBet) {
        action = 'bet';
        amount = valid.minBet + Math.floor(Math.random() * (actorPlayer.stack - valid.minBet) * 0.3);
      } else {
        action = 'check';
      }
    } else if (valid.canCall) {
      if (roll < 0.4 && valid.canRaise && valid.minRaise <= actorPlayer.stack) {
        action = 'raise';
        amount = valid.minRaise + Math.floor(Math.random() * (valid.maxRaise - valid.minRaise) * 0.3);
      } else {
        action = 'call';
      }
    } else if (valid.canFold) {
      action = 'fold';
    } else {
      logError(`No valid action for ${testPlayer.name}`);
      break;
    }

    const success = await simulateAction(tableId, testPlayer.id, testPlayer.name, action, amount);
    if (!success) {
      break;
    }

    // Small delay to prevent race conditions
    await new Promise(r => setTimeout(r, 10));
  }

  if (iterations >= MAX_ITERATIONS) {
    logError(`Hand exceeded max iterations!`);
  }

  // Final state
  await printTableState(tableId, 'Hand complete');

  // Wait for any showdown to complete
  await new Promise(r => setTimeout(r, 100));

  // Check for eliminated players
  const finalState = await getTableState(tableId);
  const eliminated = finalState.players.filter(p => p.stack === 0);
  if (eliminated.length > 0) {
    for (const p of eliminated) {
      const tp = players.find(pl => pl.id === p.playerId);
      logInfo(`${tp?.name || 'Unknown'} eliminated with 0 chips`);
    }
  }

  // Return number of active players
  return finalState.players.filter(p => p.stack > 0 && p.status !== 'eliminated').length;
}

async function runTest() {
  try {
    log('\n' + '═'.repeat(60), colors.bright);
    log('  POKER GAME SIMULATION TEST', colors.bright);
    log('═'.repeat(60), colors.bright);

    // Setup
    const gameState = await setupGame();

    // Play multiple hands
    let activePlayerCount = NUM_PLAYERS;
    let handNum = 1;
    const MAX_HANDS = 10;

    while (activePlayerCount >= 2 && handNum <= MAX_HANDS) {
      activePlayerCount = await playHand(gameState, handNum);
      handNum++;

      // Small delay between hands
      await new Promise(r => setTimeout(r, 100));

      // Advance game state to start next hand if needed
      await advanceGameState(gameState.tableId);
    }

    // Summary
    log('\n' + '═'.repeat(60), colors.bright);
    log('  TEST COMPLETE', colors.bright);
    log('═'.repeat(60), colors.bright);

    const finalState = await getTableState(gameState.tableId);
    log(`\nFinal standings:`, colors.yellow);
    for (const p of finalState.players.sort((a, b) => b.stack - a.stack)) {
      const tp = gameState.players.find(pl => pl.id === p.playerId);
      log(`  ${tp?.name || 'Unknown'}: $${p.stack}`);
    }

    logSuccess(`\nCompleted ${handNum - 1} hands successfully!`);

  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runTest().then(() => {
  log('\nTest finished.', colors.green);
  process.exit(0);
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
