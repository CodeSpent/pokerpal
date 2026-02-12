'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useChannel, useChannelEvent } from '@/hooks/usePusher';
import { Plus, Users, Trophy, Coins, ArrowLeft, RefreshCw, Lock } from 'lucide-react';
import type { TournamentSummary } from '@/lib/poker-engine-v2/types';

export default function LobbyPage() {
  const router = useRouter();

  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to tournaments channel for real-time updates
  const tournamentsChannel = useChannel('tournaments');

  // Handle new tournament created
  const handleTournamentCreated = useCallback((data: TournamentSummary) => {
    setTournaments((prev) => {
      if (prev.some((t) => t.id === data.id)) {
        return prev;
      }
      return [data, ...prev];
    });
  }, []);

  useChannelEvent(tournamentsChannel, 'TOURNAMENT_CREATED', handleTournamentCreated);

  // Fetch tournaments
  const fetchTournaments = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/tournaments');
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Failed to fetch tournaments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white">Tournament Lobby</h1>
            <p className="text-zinc-400 text-sm">Join a table or create your own</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/play/create"
            className={cn(
              'flex items-center gap-2 px-4 sm:px-6 py-3 rounded-lg font-bold whitespace-nowrap',
              'bg-emerald-600 text-white hover:bg-emerald-700',
              'transition-colors'
            )}
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">Create Tournament</span>
            <span className="sm:hidden">Create</span>
          </Link>

          <button
            onClick={fetchTournaments}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-lg whitespace-nowrap',
              'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
              'transition-colors',
              isLoading && 'opacity-50'
            )}
          >
            <RefreshCw className={cn('w-5 h-5 shrink-0', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tournament list */}
      <div className="max-w-6xl mx-auto">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-zinc-400">Loading tournaments...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12 bg-zinc-900/50 rounded-xl border border-zinc-800">
            <Trophy className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              No Open Tournaments
            </h3>
            <p className="text-zinc-400 mb-6">
              Be the first to create a tournament!
            </p>
            <Link
              href="/play/create"
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold whitespace-nowrap',
                'bg-emerald-600 text-white hover:bg-emerald-700',
                'transition-colors'
              )}
            >
              <Plus className="w-5 h-5 shrink-0" />
              Create
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                onRegister={() => {
                  router.push(`/play/tournament/${tournament.id}`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentCard({
  tournament,
  onRegister,
}: {
  tournament: TournamentSummary;
  onRegister: () => void;
}) {
  const isFull = tournament.registeredCount >= tournament.maxPlayers;
  const progress = (tournament.registeredCount / tournament.maxPlayers) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-zinc-900 rounded-xl p-6 border border-zinc-800',
        'hover:border-zinc-700 transition-colors'
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {tournament.name}
            {tournament.isPasswordProtected && (
              <Lock className="w-4 h-4 text-amber-400" />
            )}
          </h3>
          <p className="text-sm text-zinc-400">
            {tournament.maxPlayers}-player SNG
          </p>
        </div>
        <span
          className={cn(
            'px-2 py-1 rounded text-xs font-medium',
            tournament.status === 'registering'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-zinc-500/20 text-zinc-400'
          )}
        >
          {tournament.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-zinc-500 mb-1">Starting Stack</div>
          <div className="flex items-center gap-1 text-white">
            <Coins className="w-4 h-4 text-emerald-400" />
            <span className="font-mono">{tournament.startingChips.toLocaleString()}</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1">Players</div>
          <div className="flex items-center gap-1 text-white">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="font-mono">
              {tournament.registeredCount} / {tournament.maxPlayers}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Register button */}
      <button
        onClick={onRegister}
        disabled={isFull}
        className={cn(
          'w-full py-2 rounded-lg font-medium transition-colors',
          isFull
            ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
        )}
      >
        {isFull ? 'Full' : 'Join Tournament'}
      </button>
    </motion.div>
  );
}
