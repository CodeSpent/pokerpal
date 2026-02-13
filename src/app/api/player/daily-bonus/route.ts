import { NextResponse } from 'next/server';
import { getAuthenticatedPlayer } from '@/lib/auth/get-player';
import { chipTxRepo } from '@/lib/db/repositories';

const DAILY_BONUS_THRESHOLD = 5000;
const DAILY_BONUS_AMOUNT = 5000;

/**
 * GET /api/player/daily-bonus
 * Check daily bonus eligibility
 */
export async function GET() {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const currentBalance = await chipTxRepo.getBalance(authPlayer.playerId);
    const alreadyClaimed = await chipTxRepo.hasClaimedDailyBonus(authPlayer.playerId);
    const eligible = currentBalance < DAILY_BONUS_THRESHOLD && !alreadyClaimed;

    return NextResponse.json({
      eligible,
      currentBalance,
      threshold: DAILY_BONUS_THRESHOLD,
      bonusAmount: DAILY_BONUS_AMOUNT,
      alreadyClaimed,
    });
  } catch (error) {
    console.error('Error checking daily bonus:', error);
    return NextResponse.json({ error: 'Failed to check daily bonus' }, { status: 500 });
  }
}

/**
 * POST /api/player/daily-bonus
 * Claim the daily bonus
 */
export async function POST() {
  try {
    const authPlayer = await getAuthenticatedPlayer();
    if (!authPlayer) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const currentBalance = await chipTxRepo.getBalance(authPlayer.playerId);
    if (currentBalance >= DAILY_BONUS_THRESHOLD) {
      return NextResponse.json(
        { error: `Balance must be below ${DAILY_BONUS_THRESHOLD} to claim daily bonus` },
        { status: 400 }
      );
    }

    const alreadyClaimed = await chipTxRepo.hasClaimedDailyBonus(authPlayer.playerId);
    if (alreadyClaimed) {
      return NextResponse.json(
        { error: 'Daily bonus already claimed in the last 24 hours' },
        { status: 400 }
      );
    }

    const tx = await chipTxRepo.recordTransaction({
      playerId: authPlayer.playerId,
      type: 'daily_bonus',
      amount: DAILY_BONUS_AMOUNT,
      description: 'Daily bonus',
    });

    return NextResponse.json({
      success: true,
      newBalance: tx.balanceAfter,
      amount: DAILY_BONUS_AMOUNT,
    });
  } catch (error) {
    console.error('Error claiming daily bonus:', error);
    return NextResponse.json({ error: 'Failed to claim daily bonus' }, { status: 500 });
  }
}
