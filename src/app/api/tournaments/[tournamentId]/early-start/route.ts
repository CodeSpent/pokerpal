import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getTournament,
  startTournament,
  getRegistrationCount,
  getDatabase,
  generateId,
  now,
} from '@/lib/poker-engine-v2';

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

    const db = getDatabase();
    const tournament = getTournament(tournamentId);

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    if (action === 'initiate') {
      // Host initiates a vote
      if (tournament.creator_id !== playerId) {
        return NextResponse.json(
          { error: 'Only the host can initiate early start' },
          { status: 403 }
        );
      }

      const playerCount = getRegistrationCount(tournamentId);
      if (playerCount < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 players to start' },
          { status: 400 }
        );
      }

      // Add host's vote
      try {
        db.prepare(`
          INSERT INTO early_start_votes (id, tournament_id, player_id, voted_at)
          VALUES (?, ?, ?, ?)
        `).run(generateId(), tournamentId, playerId, now());
      } catch (err) {
        // Already voted, ignore
      }

      const votes = db.prepare(
        'SELECT player_id FROM early_start_votes WHERE tournament_id = ?'
      ).all(tournamentId) as { player_id: string }[];

      return NextResponse.json({
        success: true,
        earlyStart: {
          isVotingActive: true,
          votes: votes.map((v) => v.player_id),
        },
      });
    }

    if (action === 'vote') {
      // Player votes to start early
      try {
        db.prepare(`
          INSERT INTO early_start_votes (id, tournament_id, player_id, voted_at)
          VALUES (?, ?, ?, ?)
        `).run(generateId(), tournamentId, playerId, now());
      } catch (err) {
        return NextResponse.json(
          { error: 'Already voted' },
          { status: 400 }
        );
      }

      const votes = db.prepare(
        'SELECT player_id FROM early_start_votes WHERE tournament_id = ?'
      ).all(tournamentId) as { player_id: string }[];

      const playerCount = getRegistrationCount(tournamentId);

      // Check if everyone has voted
      if (votes.length >= playerCount) {
        const startResult = startTournament(tournamentId);

        if (startResult.success) {
          // Clear votes
          db.prepare('DELETE FROM early_start_votes WHERE tournament_id = ?').run(tournamentId);

          return NextResponse.json({
            success: true,
            tournamentStarted: true,
            tables: startResult.data!.tables.map((t) => t.id),
          });
        }
      }

      return NextResponse.json({
        success: true,
        earlyStart: {
          isVotingActive: true,
          votes: votes.map((v) => v.player_id),
        },
        votesCount: votes.length,
        totalPlayers: playerCount,
      });
    }

    if (action === 'cancel') {
      // Host cancels the vote
      if (tournament.creator_id !== playerId) {
        return NextResponse.json(
          { error: 'Only the host can cancel early start' },
          { status: 403 }
        );
      }

      db.prepare('DELETE FROM early_start_votes WHERE tournament_id = ?').run(tournamentId);

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
      if (tournament.creator_id !== playerId) {
        return NextResponse.json(
          { error: 'Only the host can force start' },
          { status: 403 }
        );
      }

      const playerCount = getRegistrationCount(tournamentId);
      if (playerCount < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 players to start' },
          { status: 400 }
        );
      }

      const startResult = startTournament(tournamentId);

      if (!startResult.success) {
        return NextResponse.json(
          { error: startResult.error },
          { status: 400 }
        );
      }

      // Clear votes
      db.prepare('DELETE FROM early_start_votes WHERE tournament_id = ?').run(tournamentId);

      return NextResponse.json({
        success: true,
        tournamentStarted: true,
        tables: startResult.data!.tables.map((t) => t.id),
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
