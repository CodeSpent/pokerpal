import { NextResponse } from 'next/server';
import {
  getTournament,
  getRegistrationsWithPlayers,
  getDatabase,
} from '@/lib/poker-engine-v2';

/**
 * GET /api/tournaments/[tournamentId]
 * Get tournament details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params;
    const tournament = getTournament(tournamentId);

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Get registrations with player details
    const registrations = getRegistrationsWithPlayers(tournamentId);

    // Get tables for this tournament
    const db = getDatabase();
    const tables = db.prepare(
      'SELECT id FROM tables WHERE tournament_id = ?'
    ).all(tournamentId) as { id: string }[];

    // Get early start votes
    const votes = db.prepare(
      'SELECT player_id FROM early_start_votes WHERE tournament_id = ?'
    ).all(tournamentId) as { player_id: string }[];

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        registeredPlayers: registrations.map((r) => ({
          id: r.player_id,
          displayName: r.name,
        })),
        maxPlayers: tournament.max_players,
        tableSize: tournament.table_size,
        startingChips: tournament.starting_chips,
        currentLevel: tournament.current_level,
        tables: tables.map((t) => t.id),
        playersRemaining: tournament.players_remaining,
        createdAt: tournament.created_at,
        startedAt: tournament.started_at,
        isPasswordProtected: false, // TODO: Add password support
        creatorId: tournament.creator_id,
        earlyStart: {
          isVotingActive: votes.length > 0,
          votes: votes.map((v) => v.player_id),
        },
      },
    });
  } catch (error) {
    console.error('Error getting tournament:', error);
    return NextResponse.json(
      { error: 'Failed to get tournament' },
      { status: 500 }
    );
  }
}
