import { create } from 'zustand';
import type { Card, Street, Action } from '@/types/poker';
import type {
  TableState,
  Seat,
  SidePot,
  ActionRecord,
  TableEvent,
} from '@/lib/poker-engine-v2/types';

// Generate unique ID for optimistic actions
function generateOptimisticId(): string {
  return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Generate deterministic event ID based on event content
// This ensures the same logical event generates the same ID regardless of source (Pusher vs polling)
function generateDeterministicEventId(event: TableEvent): string {
  switch (event.type) {
    case 'HAND_COMPLETE': {
      const e = event as { handNumber?: number };
      return `hand-complete-${e.handNumber ?? 'unknown'}`;
    }
    case 'SHOWDOWN': {
      const e = event as { handNumber?: number; pot?: number };
      // Prefer handNumber for consistency with server eventId
      if (e.handNumber) {
        return `showdown-${e.handNumber}`;
      }
      // Fallback for legacy events without handNumber
      return `showdown-${e.pot ?? 0}`;
    }
    case 'ACTION': {
      const e = event as { record?: ActionRecord };
      return `action-${e.record?.seatIndex}-${e.record?.action}-${e.record?.timestamp ?? 0}`;
    }
    case 'HAND_STARTED': {
      const e = event as { handNumber?: number };
      return `hand-started-${e.handNumber ?? 'unknown'}`;
    }
    case 'TURN_STARTED': {
      const e = event as { seatIndex?: number; expiresAt?: number };
      return `turn-${e.seatIndex}-${e.expiresAt ?? 'unlimited'}`;
    }
    case 'STREET_DEALT': {
      const e = event as { street?: string; cards?: unknown[] };
      return `street-${e.street}-${e.cards?.length ?? 0}`;
    }
    case 'POT_UPDATED': {
      const e = event as { pot?: number };
      return `pot-${e.pot ?? 0}`;
    }
    case 'WINNER': {
      const e = event as { winners?: Array<{ seatIndex: number; amount: number }> };
      const winnersKey = e.winners?.map(w => `${w.seatIndex}:${w.amount}`).join(',') ?? '';
      return `winner-${winnersKey}`;
    }
    default:
      // For unknown events, use a hash of the stringified content
      return `${event.type}-${JSON.stringify(event).slice(0, 100)}`;
  }
}

// Snapshot of state needed for rollback
interface StateSnapshot {
  seats: Seat[];
  pot: number;
  currentBet: number;
  lastAction: ActionRecord | null;
  currentActorSeatIndex: number | null;
  validActions: ValidActions | null;
}

// Pending optimistic action
export interface PendingAction {
  id: string;
  action: Action;
  amount?: number;
  seatIndex: number;
  previousState: StateSnapshot;
}

// Valid actions returned from server
export interface ValidActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  minBet: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
}

interface TableStoreState {
  // Table state from server
  tableId: string | null;
  tournamentId: string | null;
  tableNumber: number;

  // Seats
  seats: Seat[];
  maxSeats: 6 | 9;

  // Dealer and blinds
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;

  // Hand state
  handNumber: number;
  phase: TableState['phase'];
  communityCards: Card[];
  pot: number;
  sidePots: SidePot[];

  // Betting
  currentBet: number;
  minRaise: number;

  // Turn tracking
  currentActorSeatIndex: number | null;
  turnExpiresAt: number | null;
  turnIsUnlimited: boolean;
  lastAction: ActionRecord | null;

  // Hero state
  heroSeatIndex: number | null;
  heroHoleCards: [Card, Card] | null;

  // Blinds
  smallBlind: number;
  bigBlind: number;
  ante: number;

  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Version tracking for sync
  version: number;
  lastEventId: number;

  // Server-computed valid actions (when it's hero's turn)
  validActions: ValidActions | null;

  // Showdown result for displaying winner(s)
  showdownResult: {
    winners: Array<{
      playerId: string;
      seatIndex: number;
      holeCards: [Card, Card];
      handRank: string;
      description: string;
      bestCards: Card[]; // The 5 cards that make up the best hand
      amount: number;
    }>;
    pot: number;
  } | null;

  // Optimistic update tracking
  pendingAction: PendingAction | null;

  // Event deduplication - tracks event IDs we've already applied
  appliedEventIds: Set<string>;

  // Last sync timestamp for staleness detection
  lastSyncTimestamp: number;

  // Showdown lock - enforces minimum display time for showdown
  showdownReceivedAt: number | null;
  newHandLockedUntil: number | null;

  // Showdown deduplication - tracks which hand's showdown we've applied
  showdownAppliedForHand: number | null;

  // Actions
  setTableState: (state: TableState, heroSeatIndex: number, version?: number, lastEventId?: number, validActions?: ValidActions | null) => void;
  setValidActions: (validActions: ValidActions | null) => void;
  setHeroHoleCards: (cards: [Card, Card]) => void;
  applyEvent: (event: TableEvent) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateVersion: (version: number, lastEventId: number) => void;
  setShowdownResult: (result: TableStoreState['showdownResult']) => void;
  clearShowdownResult: () => void;
  reset: () => void;

  // Optimistic update actions
  applyOptimisticAction: (action: Action, amount: number | undefined, seatIndex: number) => string;
  confirmOptimisticAction: (actionId: string) => void;
  rollbackOptimisticAction: (actionId: string, error?: string) => void;

  // Event deduplication
  isEventApplied: (eventId: string) => boolean;
  markEventApplied: (eventId: string) => void;

  // Sync tracking
  updateLastSyncTimestamp: () => void;
}

const INITIAL_STATE = {
  tableId: null,
  tournamentId: null,
  tableNumber: 0,
  seats: [],
  maxSeats: 6 as const,
  dealerSeatIndex: 0,
  smallBlindSeatIndex: 0,
  bigBlindSeatIndex: 0,
  handNumber: 0,
  phase: 'waiting' as const,
  communityCards: [],
  pot: 0,
  sidePots: [],
  currentBet: 0,
  minRaise: 0,
  currentActorSeatIndex: null,
  turnExpiresAt: null,
  turnIsUnlimited: false,
  lastAction: null,
  heroSeatIndex: null,
  heroHoleCards: null,
  smallBlind: 0,
  bigBlind: 0,
  ante: 0,
  isConnected: false,
  isLoading: false,
  error: null,
  version: 0,
  lastEventId: 0,
  validActions: null,
  showdownResult: null,
  pendingAction: null,
  appliedEventIds: new Set<string>(),
  lastSyncTimestamp: 0,
  showdownReceivedAt: null,
  newHandLockedUntil: null,
  showdownAppliedForHand: null,
};

export const useTableStore = create<TableStoreState>((set, get) => ({
  ...INITIAL_STATE,

  setTableState: (state, heroSeatIndex, version, lastEventId, validActions) => {
    const current = get();

    // If we're in showdown lock and server says new hand started,
    // keep showdown state - don't overwrite with new hand data yet
    if (current.newHandLockedUntil && Date.now() < current.newHandLockedUntil) {
      // Server has new hand, but we're still showing showdown
      if (state.phase === 'preflop' || state.phase === 'dealing') {
        // Don't update phase-related state, just update non-disruptive fields
        set({
          isLoading: false,
          error: null,
        });
        return;
      }
    }

    // Extract hero's hole cards from their seat
    // Note: heroSeatIndex is the seat number, not array index - use find()
    const heroSeat = state.seats.find(s => s.index === heroSeatIndex);
    const heroHoleCards = heroSeat?.player?.holeCards || null;

    // If transitioning from showdown to new hand, clear the lock
    const clearingShowdown = current.phase === 'showdown' && (state.phase === 'preflop' || state.phase === 'dealing');

    // Preserve existing showdownResult during showdown phase for same hand
    // This prevents polling from overwriting showdown state we already have
    const preserveShowdown =
      current.phase === 'showdown' &&
      current.showdownResult !== null &&
      current.handNumber === state.handNumber;

    // Determine showdown state updates
    let showdownUpdates: Record<string, unknown> = {};
    if (clearingShowdown) {
      // Transitioning to new hand - clear all showdown state
      showdownUpdates = {
        showdownReceivedAt: null,
        newHandLockedUntil: null,
        showdownResult: null,
        showdownAppliedForHand: null,
      };
    } else if (preserveShowdown) {
      // Keep existing showdown state - don't overwrite what we have
      showdownUpdates = {
        showdownResult: current.showdownResult,
        showdownAppliedForHand: current.showdownAppliedForHand,
        showdownReceivedAt: current.showdownReceivedAt,
        newHandLockedUntil: current.newHandLockedUntil,
      };
    }

    set({
      tableId: state.id,
      tournamentId: state.tournamentId,
      tableNumber: state.tableNumber,
      seats: state.seats,
      maxSeats: state.maxSeats,
      dealerSeatIndex: state.dealerSeatIndex,
      smallBlindSeatIndex: state.smallBlindSeatIndex ?? 0,
      bigBlindSeatIndex: state.bigBlindSeatIndex ?? 0,
      handNumber: state.handNumber,
      phase: state.phase,
      communityCards: state.communityCards,
      pot: state.pot,
      sidePots: state.sidePots,
      currentBet: state.currentBet,
      minRaise: state.minRaise,
      currentActorSeatIndex: state.currentActorSeatIndex ?? null,
      turnExpiresAt: state.turnExpiresAt ?? null,
      turnIsUnlimited: (state as unknown as { turnIsUnlimited?: boolean }).turnIsUnlimited ?? false,
      lastAction: state.lastAction ?? null,
      heroSeatIndex,
      heroHoleCards,
      smallBlind: state.smallBlind,
      bigBlind: state.bigBlind,
      ante: state.ante,
      isLoading: false,
      error: null,
      version: version ?? (state as unknown as { version?: number }).version ?? 0,
      lastEventId: lastEventId ?? get().lastEventId,
      validActions: validActions ?? null,
      ...showdownUpdates,
    });
  },

  setValidActions: (validActions) =>
    set({ validActions }),

  setHeroHoleCards: (cards) =>
    set({ heroHoleCards: cards }),

  applyEvent: (event) => {
    const state = get();

    // Generate event ID for deduplication
    // Use provided eventId if available, otherwise generate deterministic ID from event content
    const eventWithId = event as { eventId?: string };
    const eventId = eventWithId.eventId || generateDeterministicEventId(event);

    // Skip if we've already applied this event
    if (state.appliedEventIds.has(eventId)) {
      return;
    }

    // For ACTION events, check if this matches our pending optimistic action
    if (event.type === 'ACTION' && state.pendingAction) {
      const pending = state.pendingAction;
      const actionEvent = event as { record: ActionRecord };

      // Check if this is confirmation of our optimistic action
      const normalizedPendingAction = pending.action === 'all-in' ? 'all_in' : pending.action;
      if (
        actionEvent.record.seatIndex === pending.seatIndex &&
        actionEvent.record.action === normalizedPendingAction
      ) {
        // This confirms our optimistic action - just clear pending, don't re-apply
        set({
          pendingAction: null,
          appliedEventIds: new Set([...state.appliedEventIds, eventId]),
        });
        return;
      }
    }

    // Mark event as applied
    const newAppliedIds = new Set(state.appliedEventIds);
    newAppliedIds.add(eventId);
    // Trim to prevent memory leak
    if (newAppliedIds.size > 500) {
      const idsArray = Array.from(newAppliedIds);
      set({ appliedEventIds: new Set(idsArray.slice(-500)) });
    } else {
      set({ appliedEventIds: newAppliedIds });
    }

    switch (event.type) {
      case 'PLAYER_SEATED':
        set({
          seats: state.seats.map((s) =>
            s.index === event.seat.index ? event.seat : s
          ),
        });
        break;

      case 'PLAYER_LEFT':
        set({
          seats: state.seats.map((s) =>
            s.index === event.seatIndex
              ? { ...s, player: null, isDealer: false, isSmallBlind: false, isBigBlind: false }
              : s
          ),
        });
        break;

      case 'HAND_STARTED': {
        // Check if we're still in showdown lock period
        const { newHandLockedUntil } = state;
        const now = Date.now();

        // If in showdown lock period, don't process this event yet
        // Polling will pick it up again after the lock expires
        if (newHandLockedUntil && now < newHandLockedUntil) {
          return;
        }

        // Event may come from different sources with different property names
        // Use a loose type to handle all variations
        const handEvent = event as {
          type: 'HAND_STARTED';
          handNumber: number;
          dealerSeatIndex?: number;
          dealerSeat?: number;
          smallBlindSeatIndex?: number;
          smallBlindSeat?: number;
          bigBlindSeatIndex?: number;
          bigBlindSeat?: number;
          firstActorSeatIndex?: number;
          firstActorSeat?: number;
          blinds?: { sb: number; bb: number };
        };

        // Clear showdown lock and proceed with new hand
        set({
          handNumber: handEvent.handNumber,
          phase: 'preflop',
          communityCards: [],
          pot: 0,
          sidePots: [],
          currentBet: handEvent.blinds?.bb ?? 0,
          heroHoleCards: null,
          dealerSeatIndex: handEvent.dealerSeatIndex ?? handEvent.dealerSeat ?? 0,
          smallBlindSeatIndex: handEvent.smallBlindSeatIndex ?? handEvent.smallBlindSeat ?? 0,
          bigBlindSeatIndex: handEvent.bigBlindSeatIndex ?? handEvent.bigBlindSeat ?? 0,
          currentActorSeatIndex: handEvent.firstActorSeatIndex ?? handEvent.firstActorSeat ?? null,
          showdownResult: null, // Clear showdown result for new hand
          showdownReceivedAt: null, // Clear showdown lock
          newHandLockedUntil: null,
          showdownAppliedForHand: null, // Clear showdown deduplication
        });
        break;
      }

      case 'HOLE_CARDS_DEALT':
        set({ heroHoleCards: event.cards });
        break;

      case 'ACTION':
        set({
          lastAction: event.record,
          // Update seat state based on action
          seats: state.seats.map((s) => {
            if (s.index !== event.record.seatIndex || !s.player) return s;

            const updatedPlayer = { ...s.player };

            if (event.record.action === 'fold') {
              updatedPlayer.status = 'folded';
            } else if (event.record.action === 'all_in') {
              updatedPlayer.isAllIn = true;
              updatedPlayer.currentBet = event.record.amount || s.player.currentBet;
              updatedPlayer.stack = 0;
            } else if (event.record.amount) {
              const diff = event.record.amount - s.player.currentBet;
              updatedPlayer.currentBet = event.record.amount;
              updatedPlayer.stack = Math.max(0, s.player.stack - diff);
            }

            updatedPlayer.hasActed = true;
            return { ...s, player: updatedPlayer };
          }),
        });
        break;

      case 'STREET_DEALT':
        set({
          phase: event.street as TableState['phase'],
          communityCards: [...state.communityCards, ...event.cards],
          currentBet: 0,
          // Reset hasActed for all players
          seats: state.seats.map((s) => ({
            ...s,
            player: s.player
              ? { ...s.player, hasActed: false, currentBet: 0 }
              : null,
          })),
        });
        break;

      case 'POT_UPDATED':
        set({
          pot: event.pot,
          sidePots: event.sidePots,
        });
        break;

      case 'TURN_STARTED':
        set({
          currentActorSeatIndex: event.seatIndex,
          turnExpiresAt: event.expiresAt,
          turnIsUnlimited: event.isUnlimited ?? false,
        });
        break;

      case 'PLAYER_TIMEOUT':
        // Server will send ACTION event for auto-fold
        break;

      case 'SHOWDOWN': {
        // Parse the SHOWDOWN event which includes winners with hole cards and best hand info
        const showdownEvent = event as {
          type: 'SHOWDOWN';
          handNumber?: number;
          communityCards?: string[];
          winners: Array<{
            playerId: string;
            seatIndex: number;
            holeCards: [string, string];
            handRank: string;
            description: string;
            bestCards?: string[];
            amount: number;
          }>;
          pot: number;
          // Legacy support for reveals
          reveals?: Array<{ seatIndex: number; cards: [Card, Card] }>;
        };

        // Secondary deduplication: skip if we've already applied showdown for this hand
        if (showdownEvent.handNumber &&
            state.showdownAppliedForHand === showdownEvent.handNumber) {
          return;
        }

        // Parse card strings to Card objects
        const parseCardStr = (cardStr: string): Card => ({
          rank: cardStr[0] as Card['rank'],
          suit: cardStr[1] as Card['suit'],
        });

        // Build showdownResult from winners
        const showdownResult = {
          winners: showdownEvent.winners.map((w) => ({
            playerId: w.playerId,
            seatIndex: w.seatIndex,
            holeCards: [parseCardStr(w.holeCards[0]), parseCardStr(w.holeCards[1])] as [Card, Card],
            handRank: w.handRank,
            description: w.description,
            bestCards: (w.bestCards || []).map(parseCardStr),
            amount: w.amount,
          })),
          pot: showdownEvent.pot,
        };

        // Reveal hole cards for all shown players
        const revealedSeats = state.seats.map((s) => {
          // Check if this seat is a winner
          const winner = showdownEvent.winners.find((w) => w.seatIndex === s.index);
          if (winner && s.player) {
            return {
              ...s,
              player: {
                ...s.player,
                holeCards: [parseCardStr(winner.holeCards[0]), parseCardStr(winner.holeCards[1])] as [Card, Card],
              },
            };
          }
          // Legacy support for reveals
          if (showdownEvent.reveals) {
            const reveal = showdownEvent.reveals.find((r) => r.seatIndex === s.index);
            if (reveal && s.player) {
              return {
                ...s,
                player: { ...s.player, holeCards: reveal.cards },
              };
            }
          }
          return s;
        });

        // Set showdown lock - enforce minimum 8 seconds display time
        const now = Date.now();
        set({
          phase: 'showdown',
          seats: revealedSeats,
          showdownResult,
          showdownReceivedAt: now,
          newHandLockedUntil: now + 8000, // Lock for 8 seconds
          showdownAppliedForHand: showdownEvent.handNumber ?? null,
        });
        break;
      }

      case 'WINNER':
        set({
          phase: 'awarding',
          pot: 0,
          sidePots: [],
          // Update winner stacks
          seats: state.seats.map((s) => {
            const win = event.winners.find((w) => w.seatIndex === s.index);
            if (win && s.player) {
              return {
                ...s,
                player: {
                  ...s.player,
                  stack: s.player.stack + win.amount,
                },
              };
            }
            return s;
          }),
        });
        break;

      case 'HAND_COMPLETE': {
        // Parse HAND_COMPLETE which may include winner info
        const completeEvent = event as {
          type: 'HAND_COMPLETE';
          handNumber?: number;
          winners?: Array<{
            playerId: string;
            seatIndex: number;
            holeCards: [string, string];
            handRank: string;
            description: string;
            bestCards?: string[];
            amount: number;
          }>;
        };

        // Parse card strings to Card objects
        const parseCardStr = (cardStr: string): Card => ({
          rank: cardStr[0] as Card['rank'],
          suit: cardStr[1] as Card['suit'],
        });

        // If we have winners and no showdownResult yet, build it
        let newShowdownResult = state.showdownResult;
        if (completeEvent.winners && completeEvent.winners.length > 0 && !state.showdownResult) {
          newShowdownResult = {
            winners: completeEvent.winners.map((w) => ({
              playerId: w.playerId,
              seatIndex: w.seatIndex,
              holeCards: [parseCardStr(w.holeCards[0]), parseCardStr(w.holeCards[1])] as [Card, Card],
              handRank: w.handRank,
              description: w.description,
              bestCards: (w.bestCards || []).map(parseCardStr),
              amount: w.amount,
            })),
            pot: 0,
          };
        }

        set({
          phase: 'hand-complete',
          currentActorSeatIndex: null,
          turnExpiresAt: null,
          turnIsUnlimited: false,
          showdownResult: newShowdownResult,
        });
        break;
      }

      default:
        break;
    }

    // Update sync timestamp for successfully applied events
    set({ lastSyncTimestamp: Date.now() });
  },

  setConnected: (connected) =>
    set({ isConnected: connected }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setError: (error) =>
    set({ error }),

  updateVersion: (version, lastEventId) =>
    set({ version, lastEventId }),

  setShowdownResult: (result) =>
    set({ showdownResult: result }),

  clearShowdownResult: () =>
    set({ showdownResult: null }),

  reset: () =>
    set(INITIAL_STATE),

  // Optimistic update: apply action immediately before server confirmation
  applyOptimisticAction: (action, amount, seatIndex) => {
    const state = get();
    const actionId = generateOptimisticId();

    // Snapshot current state for rollback
    const previousState: StateSnapshot = {
      seats: JSON.parse(JSON.stringify(state.seats)), // Deep clone
      pot: state.pot,
      currentBet: state.currentBet,
      lastAction: state.lastAction,
      currentActorSeatIndex: state.currentActorSeatIndex,
      validActions: state.validActions,
    };

    // Calculate optimistic changes to hero's seat
    const updatedSeats = state.seats.map((s) => {
      if (s.index !== seatIndex || !s.player) return s;

      const player = { ...s.player };

      switch (action) {
        case 'fold':
          player.status = 'folded';
          break;
        case 'check':
          player.hasActed = true;
          break;
        case 'call':
          {
            const callAmount = state.currentBet - player.currentBet;
            player.stack = Math.max(0, player.stack - callAmount);
            player.currentBet = state.currentBet;
            player.hasActed = true;
            if (player.stack === 0) {
              player.isAllIn = true;
            }
          }
          break;
        case 'bet':
        case 'raise':
          if (amount !== undefined) {
            const diff = amount - player.currentBet;
            player.stack = Math.max(0, player.stack - diff);
            player.currentBet = amount;
            player.hasActed = true;
            if (player.stack === 0) {
              player.isAllIn = true;
            }
          }
          break;
        case 'all-in':
          player.currentBet = player.currentBet + player.stack;
          player.stack = 0;
          player.isAllIn = true;
          player.hasActed = true;
          break;
      }

      return { ...s, player };
    });

    // Build optimistic action record
    const actionRecord: ActionRecord = {
      seatIndex,
      action: action === 'all-in' ? 'all_in' : action,
      amount: amount ?? 0,
      timestamp: Date.now(),
    };

    set({
      pendingAction: { id: actionId, action, amount, seatIndex, previousState },
      seats: updatedSeats,
      lastAction: actionRecord,
      currentActorSeatIndex: null, // Clear while pending
      validActions: null,
    });

    return actionId;
  },

  // Server confirmed the action - clear pending state
  confirmOptimisticAction: (actionId) => {
    const state = get();
    if (state.pendingAction?.id === actionId) {
      set({ pendingAction: null });
    }
  },

  // Action failed - rollback to previous state
  rollbackOptimisticAction: (actionId, _error) => {
    const state = get();
    if (state.pendingAction?.id === actionId) {
      const { previousState } = state.pendingAction;
      set({
        seats: previousState.seats,
        pot: previousState.pot,
        currentBet: previousState.currentBet,
        lastAction: previousState.lastAction,
        currentActorSeatIndex: previousState.currentActorSeatIndex,
        validActions: previousState.validActions,
        pendingAction: null,
      });
    }
  },

  // Check if an event has already been applied
  isEventApplied: (eventId) => {
    return get().appliedEventIds.has(eventId);
  },

  // Mark an event as applied (with cleanup for memory management)
  markEventApplied: (eventId) => {
    const state = get();
    const newSet = new Set(state.appliedEventIds);
    newSet.add(eventId);

    // Keep only last 500 event IDs to prevent memory leak
    if (newSet.size > 500) {
      const idsArray = Array.from(newSet);
      const trimmed = new Set(idsArray.slice(-500));
      set({ appliedEventIds: trimmed });
    } else {
      set({ appliedEventIds: newSet });
    }
  },

  // Update last sync timestamp
  updateLastSyncTimestamp: () => {
    set({ lastSyncTimestamp: Date.now() });
  },
}));

/**
 * Get the hero's current seat
 * Note: heroSeatIndex is the seat number, not the array index
 */
export function useHeroSeat() {
  const { seats, heroSeatIndex } = useTableStore();
  if (heroSeatIndex === null) return null;
  // Find seat by its index property, not by array position
  return seats.find(s => s.index === heroSeatIndex) || null;
}

/**
 * Check if it's the hero's turn
 */
export function useIsHeroTurn() {
  const { currentActorSeatIndex, heroSeatIndex, validActions } = useTableStore();
  // Only return true if we have valid actions - otherwise state isn't fully synced yet
  // This prevents showing fallback controls (Fold/All-In) when validActions is null
  return (
    currentActorSeatIndex !== null &&
    currentActorSeatIndex === heroSeatIndex &&
    validActions !== null
  );
}

/**
 * Get the amount hero needs to call
 */
export function useCallAmount() {
  const { currentBet, heroSeatIndex, seats } = useTableStore();
  if (heroSeatIndex === null) return 0;

  // Find seat by its index property, not by array position
  const heroSeat = seats.find(s => s.index === heroSeatIndex);
  const heroPlayer = heroSeat?.player;
  if (!heroPlayer) return 0;

  return Math.min(currentBet - heroPlayer.currentBet, heroPlayer.stack);
}
