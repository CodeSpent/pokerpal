import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { tournamentRepo } from '@/lib/db/repositories';
import { voteForEarlyStart, startTournament } from '@/lib/game/tournament-service';
import { getDb } from '@/lib/db';
import { earlyStartVotes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';

/**
 * POST /api/tournaments/[tournamentId]/early-start
 * Handle early start voting and force start
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { tournamentId } = await params;
    const body = await request.json();
    const { action } = body;

    const tournament = await tournamentRepo.getTournament(tournamentId);

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    if (action === 'initiate') {
      // Host initiates a vote
      if (tournament.creatorId !== playerId) {
        return NextResponse.json(
          { error: 'Only the host can initiate early start' },
          { status: 403 }
        );
      }

      const playerCount = await tournamentRepo.getRegistrationCount(tournamentId);
      if (playerCount < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 players to start' },
          { status: 400 }
        );
      }

      // Add host's vote
      await tournamentRepo.addEarlyStartVote(tournamentId, playerId);

      const votes = await tournamentRepo.getEarlyStartVotes(tournamentId);

      return NextResponse.json({
        success: true,
        earlyStart: {
          isVotingActive: true,
          votes: votes.map((v) => v.playerId),
        },
      });
    }

    if (action === 'vote') {
      // Player votes to start early
      const result = await voteForEarlyStart(tournamentId, playerId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      // Check if everyone has voted
      if (result.data.shouldStart) {
        const startResult = await startTournament(tournamentId);

        if (startResult.success) {
          // Clear votes
          const db = getDb();
          await db.delete(earlyStartVotes).where(eq(earlyStartVotes.tournamentId, tournamentId));

          return NextResponse.json({
            success: true,
            tournamentStarted: true,
            tables: startResult.data.tables.map((t) => t.id),
          });
        }
      }

      const votes = await tournamentRepo.getEarlyStartVotes(tournamentId);

      return NextResponse.json({
        success: true,
        earlyStart: {
          isVotingActive: true,
          votes: votes.map((v) => v.playerId),
        },
        votesCount: result.data.voteCount,
        totalPlayers: result.data.threshold,
      });
    }

    if (action === 'cancel') {
      // Host cancels the vote
      if (tournament.creatorId !== playerId) {
        return NextResponse.json(
          { error: 'Only the host can cancel early start' },
          { status: 403 }
        );
      }

      const db = getDb();
      await db.delete(earlyStartVotes).where(eq(earlyStartVotes.tournamentId, tournamentId));

      return NextResponse.json({
        success: true,
        earlyStart: {
          isVotingActive: false,
          votes: [],
        },
      });
    }

    if (action === 'force') {
      // Host forces the start
      if (tournament.creatorId !== playerId) {
        return NextResponse.json(
          { error: 'Only the host can force start' },
          { status: 403 }
        );
      }

      const playerCount = await tournamentRepo.getRegistrationCount(tournamentId);
      if (playerCount < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 players to start' },
          { status: 400 }
        );
      }

      const startResult = await startTournament(tournamentId);

      if (!startResult.success) {
        return NextResponse.json(
          { error: startResult.error },
          { status: 400 }
        );
      }

      // Clear votes
      const db = getDb();
      await db.delete(earlyStartVotes).where(eq(earlyStartVotes.tournamentId, tournamentId));

      return NextResponse.json({
        success: true,
        tournamentStarted: true,
        tables: startResult.data.tables.map((t) => t.id),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error with early start:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
