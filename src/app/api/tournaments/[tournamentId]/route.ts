import { NextResponse } from 'next/server';
import { tournamentRepo, tableRepo } from '@/lib/db/repositories';

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
    const tournament = await tournamentRepo.getTournament(tournamentId);

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Get registrations with player details
    const registrations = await tournamentRepo.getRegistrationsWithPlayers(tournamentId);

    // Get tables for this tournament
    const tables = await tableRepo.getTournamentTables(tournamentId);

    // Get early start votes
    const votes = await tournamentRepo.getEarlyStartVotes(tournamentId);

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        registeredPlayers: registrations.map((r) => ({
          id: r.playerId,
          displayName: r.player.name,
        })),
        maxPlayers: tournament.maxPlayers,
        tableSize: tournament.tableSize,
        startingChips: tournament.startingChips,
        currentLevel: tournament.currentLevel,
        tables: tables.map((t) => t.id),
        playersRemaining: tournament.playersRemaining,
        createdAt: tournament.createdAt,
        startedAt: tournament.startedAt,
        isPasswordProtected: false,
        creatorId: tournament.creatorId,
        earlyStart: {
          isVotingActive: votes.length > 0,
          votes: votes.map((v) => v.playerId),
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
