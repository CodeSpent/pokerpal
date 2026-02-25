import type { ActionType } from '@/lib/poker-engine-v2/types';

/** Text colors for action labels */
export const ACTION_COLORS: Record<string, string> = {
  fold: 'text-red-400',
  check: 'text-zinc-400',
  call: 'text-blue-400',
  raise: 'text-emerald-400',
  'all-in': 'text-amber-400',
  all_in: 'text-amber-400',
  bet: 'text-emerald-400',
};

/** Background colors for action indicator badges */
export const ACTION_BG_COLORS: Record<string, string> = {
  fold: 'bg-action-foldMuted/60 border-action-fold/30',
  check: 'bg-surface-tertiary/60 border-surface-tertiary/50',
  call: 'bg-action-checkMuted/60 border-action-check/30',
  raise: 'bg-emerald-900/50 border-emerald-700/30',
  bet: 'bg-emerald-900/50 border-emerald-700/30',
  all_in: 'bg-action-foldMuted/60 border-action-fold/30',
  'all-in': 'bg-action-foldMuted/60 border-action-fold/30',
};

/** Actions that represent voluntary player decisions (not blind posts) */
export const VOLUNTARY_ACTIONS = new Set<ActionType>([
  'fold',
  'check',
  'call',
  'bet',
  'raise',
  'all_in',
]);

/** Format an action + optional amount into a display label */
export function formatActionLabel(action: string, amount?: number): string {
  switch (action) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return amount ? `Call ${amount.toLocaleString()}` : 'Call';
    case 'bet':
      return amount ? `Bet ${amount.toLocaleString()}` : 'Bet';
    case 'raise':
      return amount ? `Raise ${amount.toLocaleString()}` : 'Raise';
    case 'all_in':
    case 'all-in':
      return 'All In';
    case 'post_sb':
      return 'Post SB';
    case 'post_bb':
      return 'Post BB';
    case 'post_ante':
      return 'Ante';
    default:
      return action;
  }
}
