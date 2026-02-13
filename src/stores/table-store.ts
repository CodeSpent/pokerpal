import { create } from 'zustand';
import type { Card, Street, Action } from '@/types/poker';
import type {
  TableState,
  Seat,
  SidePot,
  ActionRecord,
  TableEvent,
} from '@/lib/poker-engine-v2/types';
import { parseCard } from '@/lib/card-utils';

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
    case 'TOURNAMENT_COMPLETE': {
      const e = event as { winner?: { playerId: string } };
      return `tournament-complete-${e.winner?.playerId ?? 'unknown'}`;
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
  heroCardsForHand: number | null;

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

  // Tournament winner (when tournament is complete)
  tournamentWinner: {
    playerId: string;
    name: string;
    seatIndex: number;
    stack: number;
  } | null;

  // Optimistic update tracking
  pendingAction: PendingAction | null;

  // Event deduplication - tracks event IDs we've already applied
  appliedEventIds: Set<string>;

  // Last sync timestamp for staleness detection
  lastSyncTimestamp: number;

  // Voluntarily shown cards (after folding)
  // Maps seat index to the cards shown [card1 | null, card2 | null]
  shownCards: Record<number, [Card | null, Card | null]>;

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
  setTournamentWinner: (winner: TableStoreState['tournamentWinner']) => void;
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
  heroCardsForHand: null,
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
  tournamentWinner: null,
  pendingAction: null,
  appliedEventIds: new Set<string>(),
  lastSyncTimestamp: 0,
  shownCards: {},
};

export const useTableStore = create<TableStoreState>((set, get) => ({
  ...INITIAL_STATE,

  setTableState: (state, heroSeatIndex, version, lastEventId, validActions) => {
    // Extract hero's hole cards from their seat
    const heroSeat = state.seats.find(s => s.index === heroSeatIndex);
    const heroHoleCards = heroSeat?.player?.holeCards || null;

    // Preserve showdownResult during showdown phase (prevents fetch from clearing it)
    const current = get();
    const preserveShowdown =
      state.phase === 'showdown' &&
      current.showdownResult !== null &&
      current.handNumber === state.handNumber;

    // Mark implied events as applied to prevent duplicates when Pusher events arrive
    // This ensures events already reflected in HTTP-fetched state aren't re-applied
    const impliedEvents = new Set(current.appliedEventIds);
    if (state.handNumber > 0) {
      // Mark HAND_STARTED for current hand as applied
      impliedEvents.add(`hand-started-${state.handNumber}`);

      // Mark current street as dealt
      if (state.phase && state.phase !== 'waiting' && state.phase !== 'preflop') {
        impliedEvents.add(`street-${state.phase}-${state.communityCards.length}`);
      }

      // Mark current turn as started if there's an actor
      if (state.currentActorSeatIndex !== null && state.currentActorSeatIndex !== undefined) {
        const expiresKey = state.turnExpiresAt ?? 'unlimited';
        impliedEvents.add(`turn-${state.currentActorSeatIndex}-${expiresKey}`);
      }

      // Mark showdown if in showdown phase
      if (state.phase === 'showdown') {
        impliedEvents.add(`showdown-${state.handNumber}`);
      }
    }

    // Trim to prevent memory leak (keep last 500)
    const appliedEventIds = impliedEvents.size > 500
      ? new Set(Array.from(impliedEvents).slice(-500))
      : impliedEvents;

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
      // Preserve showdown result if still in showdown, else clear on phase change
      showdownResult: preserveShowdown ? current.showdownResult : (state.phase === 'showdown' ? current.showdownResult : null),
      // Use updated appliedEventIds with implied events
      appliedEventIds,
    });
  },

  setValidActions: (validActions) =>
    set({ validActions }),

  setHeroHoleCards: (cards) => {
    const state = get();
    set({
      heroHoleCards: cards,
      seats: state.heroSeatIndex !== null
        ? state.seats.map(s =>
            s.index === state.heroSeatIndex && s.player
              ? { ...s, player: { ...s.player, holeCards: cards } }
              : s
          )
        : state.seats,
    });
  },

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
        // Event may come from different sources with different property names
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

        // Reset seats for new hand - clear hole cards and reset player states
        // All active players should start as 'waiting' (not 'folded', not 'all_in')
        const resetSeats = state.seats.map((s) => {
          if (!s.player) return s;
          // Preserve eliminated/sitting_out statuses, reset everything else to waiting
          const persistedStatuses = ['eliminated', 'sitting_out'];
          const newStatus = persistedStatuses.includes(s.player.status as string)
            ? s.player.status
            : 'waiting';
          return {
            ...s,
            player: {
              ...s.player,
              holeCards: undefined, // Clear revealed hole cards from showdown
              currentBet: 0,
              hasActed: false,
              isAllIn: false,
              status: newStatus,
            },
          };
        });

        // Preserve heroHoleCards if they already arrived for THIS hand
        // (HOLE_CARDS_DEALT on private channel can arrive before HAND_STARTED on table channel)
        const preserveCards = state.heroCardsForHand === handEvent.handNumber;

        // Apply new hand state - server controls timing
        set({
          handNumber: handEvent.handNumber,
          phase: 'preflop',
          communityCards: [],
          pot: 0,
          sidePots: [],
          currentBet: handEvent.blinds?.bb ?? 0,
          heroHoleCards: preserveCards ? state.heroHoleCards : null,
          dealerSeatIndex: handEvent.dealerSeatIndex ?? handEvent.dealerSeat ?? 0,
          smallBlindSeatIndex: handEvent.smallBlindSeatIndex ?? handEvent.smallBlindSeat ?? 0,
          bigBlindSeatIndex: handEvent.bigBlindSeatIndex ?? handEvent.bigBlindSeat ?? 0,
          currentActorSeatIndex: handEvent.firstActorSeatIndex ?? handEvent.firstActorSeat ?? null,
          showdownResult: null, // Clear showdown result for new hand
          validActions: null, // Clear validActions until TURN_STARTED arrives
          seats: preserveCards && state.heroSeatIndex !== null
            ? resetSeats.map(s =>
                s.index === state.heroSeatIndex && s.player
                  ? { ...s, player: { ...s.player, holeCards: state.heroHoleCards! } }
                  : s
              )
            : resetSeats,
          shownCards: {}, // Clear voluntarily shown cards for new hand
        });
        break;
      }

      case 'HOLE_CARDS_DEALT': {
        const holeEvent = event as { cards: [Card, Card]; handNumber?: number };
        const forHand = holeEvent.handNumber ?? state.handNumber;
        set({
          heroHoleCards: holeEvent.cards,
          heroCardsForHand: forHand,
          seats: state.heroSeatIndex !== null
            ? state.seats.map(s =>
                s.index === state.heroSeatIndex && s.player
                  ? { ...s, player: { ...s.player, holeCards: holeEvent.cards } }
                  : s
              )
            : state.seats,
        });
        break;
      }

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
          communityCards: event.cards,
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

      case 'TURN_STARTED': {
        const turnEvent = event as {
          seatIndex: number;
          expiresAt?: number | null;
          isUnlimited?: boolean;
          validActions?: ValidActions;
        };

        // Apply validActions only if this is hero's turn, otherwise clear them
        const isHeroTurn = turnEvent.seatIndex === state.heroSeatIndex;

        set({
          currentActorSeatIndex: turnEvent.seatIndex,
          turnExpiresAt: turnEvent.expiresAt ?? null,
          turnIsUnlimited: turnEvent.isUnlimited ?? false,
          validActions: isHeroTurn ? (turnEvent.validActions ?? null) : null,
        });
        break;
      }

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
          reveals?: Array<{ seatIndex: number; cards: [Card, Card] }>;
        };

        // Build showdownResult from winners
        const showdownResult = {
          winners: showdownEvent.winners.map((w) => ({
            playerId: w.playerId,
            seatIndex: w.seatIndex,
            holeCards: [parseCard(w.holeCards[0]), parseCard(w.holeCards[1])] as [Card, Card],
            handRank: w.handRank,
            description: w.description,
            bestCards: (w.bestCards || []).map(parseCard),
            amount: w.amount,
          })),
          pot: showdownEvent.pot,
        };

        // Reveal hole cards for all shown players
        const revealedSeats = state.seats.map((s) => {
          const winner = showdownEvent.winners.find((w) => w.seatIndex === s.index);
          if (winner && s.player) {
            return {
              ...s,
              player: {
                ...s.player,
                holeCards: [parseCard(winner.holeCards[0]), parseCard(winner.holeCards[1])] as [Card, Card],
              },
            };
          }
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

        // Display showdown - server controls when HAND_STARTED is sent
        // Clear actor and validActions since no actions are possible during showdown
        set({
          phase: 'showdown',
          seats: revealedSeats,
          showdownResult,
          currentActorSeatIndex: null,
          validActions: null,
          turnExpiresAt: null,
          turnIsUnlimited: false,
        });
        break;
      }

      case 'WINNER':
        set({
          phase: 'awarding',
          pot: 0,
          sidePots: [],
          currentActorSeatIndex: null,
          validActions: null,
          turnExpiresAt: null,
          turnIsUnlimited: false,
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

        // If we have winners and no showdownResult yet, build it
        let newShowdownResult = state.showdownResult;
        if (completeEvent.winners && completeEvent.winners.length > 0 && !state.showdownResult) {
          newShowdownResult = {
            winners: completeEvent.winners.map((w) => ({
              playerId: w.playerId,
              seatIndex: w.seatIndex,
              holeCards: [parseCard(w.holeCards[0]), parseCard(w.holeCards[1])] as [Card, Card],
              handRank: w.handRank,
              description: w.description,
              bestCards: (w.bestCards || []).map(parseCard),
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

      case 'TOURNAMENT_COMPLETE': {
        const tournamentEvent = event as {
          type: 'TOURNAMENT_COMPLETE';
          winner: {
            playerId: string;
            name: string;
            seatIndex: number;
            stack: number;
          };
        };

        set({
          phase: 'tournament-complete',
          currentActorSeatIndex: null,
          validActions: null,
          turnExpiresAt: null,
          turnIsUnlimited: false,
          tournamentWinner: tournamentEvent.winner,
        });
        break;
      }

      case 'CARDS_SHOWN': {
        // Player voluntarily showed their cards (after folding)
        const cardsShownEvent = event as {
          type: 'CARDS_SHOWN';
          seatIndex: number;
          cards: [string | null, string | null];
          handNumber: number;
        };

        // Only apply if it's for the current hand
        if (cardsShownEvent.handNumber === state.handNumber) {
          const parsedCards: [Card | null, Card | null] = [
            cardsShownEvent.cards[0] ? parseCard(cardsShownEvent.cards[0]) : null,
            cardsShownEvent.cards[1] ? parseCard(cardsShownEvent.cards[1]) : null,
          ];

          set({
            shownCards: {
              ...state.shownCards,
              [cardsShownEvent.seatIndex]: parsedCards,
            },
          });
        }
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

  setTournamentWinner: (winner) =>
    set({
      tournamentWinner: winner,
      phase: winner ? 'tournament-complete' : get().phase,
    }),

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

  // Check that at least one action is actually possible
  // This prevents showing fallback controls (Fold/All-In) when state isn't ready
  const hasValidAction =
    validActions !== null &&
    (validActions.canFold ||
      validActions.canCheck ||
      validActions.canCall ||
      validActions.canBet ||
      validActions.canRaise);

  return (
    currentActorSeatIndex !== null &&
    currentActorSeatIndex === heroSeatIndex &&
    hasValidAction
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
