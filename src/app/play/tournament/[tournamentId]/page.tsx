'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { usePlayerStore } from '@/stores/player-store';
import { ArrowLeft, Users, Coins, Clock, Check, Lock, Eye, EyeOff, X, Play, Vote, Crown } from 'lucide-react';

interface TournamentDetails {
  id: string;
  name: string;
  status: string;
  registeredPlayers: Array<{ id: string; displayName: string }>;
  maxPlayers: number;
  tableSize: number;
  startingChips: number;
  currentLevel: number;
  tables: string[];
  isPasswordProtected: boolean;
  creatorId: string;
  earlyStart: {
    isVotingActive: boolean;
    votes: string[];
  };
}

export default function TournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const router = useRouter();
  const { displayName } = usePlayerStore();

  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  // Fetch tournament details
  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}`);
        const data = await res.json();

        if (data.tournament) {
          setTournament(data.tournament);

          // Check if current player is registered
          const playerCookie = document.cookie
            .split('; ')
            .find((row) => row.startsWith('pokerpal-player-id='))
            ?.split('=')[1];

          if (playerCookie) {
            setPlayerId(playerCookie);
            const registered = data.tournament.registeredPlayers.some(
              (p: { id: string }) => p.id === playerCookie
            );
            setIsRegistered(registered);
          }

          // If tournament started and we're registered, navigate to table
          if (data.tournament.status === 'running' && data.tournament.tables.length > 0) {
            // Find which table the player is at
            router.push(`/play/tournament/${tournamentId}/table/${data.tournament.tables[0]}`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch tournament:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTournament();

    // Poll for updates
    const interval = setInterval(fetchTournament, 3000);
    return () => clearInterval(interval);
  }, [tournamentId, router]);

  const handleRegister = async (providedPassword?: string) => {
    // If password-protected and no password provided, show modal
    if (tournament?.isPasswordProtected && !providedPassword && !showPasswordModal) {
      setShowPasswordModal(true);
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          password: providedPassword || undefined,
        }),
      });

      const data = await res.json();

      if (data.registered) {
        setIsRegistered(true);
        setShowPasswordModal(false);
        setPassword('');

        // If tournament started, navigate to table
        if (data.tournamentStarted && data.tables?.length > 0) {
          router.push(`/play/tournament/${tournamentId}/table/${data.tables[0]}`);
        }
      } else if (data.requiresPassword) {
        // Tournament requires password
        setShowPasswordModal(true);
        setError(null);
      } else {
        setError(data.error || 'Failed to register');
      }
    } catch (err) {
      setError('Failed to register');
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      handleRegister(password.trim());
    }
  };

  const handleUnregister = async () => {
    setIsRegistering(true);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.unregistered) {
        setIsRegistered(false);
      }
    } catch (err) {
      console.error('Failed to unregister:', err);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleEarlyStart = async (action: 'initiate' | 'vote' | 'cancel' | 'force') => {
    setIsVoting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/early-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (data.tournamentStarted && data.tables?.length > 0) {
        router.push(`/play/tournament/${tournamentId}/table/${data.tables[0]}`);
      } else if (!data.success) {
        setError(data.error || 'Failed to process request');
      }
    } catch (err) {
      setError('Failed to process request');
    } finally {
      setIsVoting(false);
    }
  };

  const isHost = playerId === tournament?.creatorId;
  const hasVoted = tournament?.earlyStart.votes.includes(playerId || '');
  const canStartEarly = tournament && tournament.registeredPlayers.length >= 2;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-zinc-400">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-white mb-4">Tournament not found</p>
          <Link
            href="/play"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  const progress = (tournament.registeredPlayers.length / tournament.maxPlayers) * 100;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/play"
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
            <p className="text-zinc-400">
              {tournament.maxPlayers}-player Sit & Go
            </p>
          </div>
        </div>

        {/* Tournament card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 mb-6"
        >
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-xs text-zinc-500 mb-1">Players</div>
              <div className="flex items-center justify-center gap-1 text-white">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="font-mono text-lg">
                  {tournament.registeredPlayers.length}/{tournament.maxPlayers}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500 mb-1">Starting Stack</div>
              <div className="flex items-center justify-center gap-1 text-white">
                <Coins className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-lg">
                  {tournament.startingChips.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-zinc-500 mb-1">Blind Levels</div>
              <div className="flex items-center justify-center gap-1 text-white">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-lg">10 min</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-zinc-400 mb-2">
              <span>Seats filled</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Register/Unregister button */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          {isRegistered ? (
            <div className="flex gap-3">
              <div className="flex-1 py-3 rounded-lg bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 text-center font-medium">
                <Check className="inline-block w-4 h-4 mr-2" />
                Registered
              </div>
              <button
                onClick={handleUnregister}
                disabled={isRegistering}
                className="px-4 py-3 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
              >
                Leave
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleRegister()}
              disabled={isRegistering || tournament.registeredPlayers.length >= tournament.maxPlayers}
              className={cn(
                'w-full py-3 rounded-lg font-bold transition-colors',
                'bg-emerald-600 text-white hover:bg-emerald-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isRegistering ? (
                'Registering...'
              ) : (
                <>
                  {tournament.isPasswordProtected && (
                    <Lock className="inline-block w-4 h-4 mr-2" />
                  )}
                  Register
                </>
              )}
            </button>
          )}
        </motion.div>

        {/* Early Start Controls - Only show if registered and not full */}
        {isRegistered && tournament.registeredPlayers.length < tournament.maxPlayers && canStartEarly && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Start Early</h2>
            </div>

            {!tournament.earlyStart.isVotingActive ? (
              // No active vote
              <>
                {isHost ? (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-400">
                      As the host, you can start the tournament early with the current players.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEarlyStart('initiate')}
                        disabled={isVoting}
                        className={cn(
                          'flex-1 py-3 rounded-lg font-medium transition-colors',
                          'bg-amber-600/20 border border-amber-500/50 text-amber-400',
                          'hover:bg-amber-600/30',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <Vote className="inline-block w-4 h-4 mr-2" />
                        {isVoting ? 'Processing...' : 'Request Vote to Start'}
                      </button>
                      <button
                        onClick={() => handleEarlyStart('force')}
                        disabled={isVoting}
                        className={cn(
                          'flex-1 py-3 rounded-lg font-medium transition-colors',
                          'bg-emerald-600 text-white hover:bg-emerald-700',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <Play className="inline-block w-4 h-4 mr-2" />
                        {isVoting ? 'Starting...' : 'Force Start Now'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">
                    The host can start the tournament early once 2 or more players have joined.
                  </p>
                )}
              </>
            ) : (
              // Active vote
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-300">
                    Vote to start with {tournament.registeredPlayers.length} players
                  </p>
                  <span className="text-sm font-mono text-amber-400">
                    {tournament.earlyStart.votes.length}/{tournament.registeredPlayers.length} votes
                  </span>
                </div>

                {/* Vote progress */}
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-amber-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(tournament.earlyStart.votes.length / tournament.registeredPlayers.length) * 100}%`,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>

                {/* Vote buttons */}
                <div className="flex gap-3">
                  {!hasVoted ? (
                    <button
                      onClick={() => handleEarlyStart('vote')}
                      disabled={isVoting}
                      className={cn(
                        'flex-1 py-3 rounded-lg font-medium transition-colors',
                        'bg-emerald-600 text-white hover:bg-emerald-700',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <Check className="inline-block w-4 h-4 mr-2" />
                      {isVoting ? 'Voting...' : 'Vote Yes'}
                    </button>
                  ) : (
                    <div className="flex-1 py-3 rounded-lg bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 text-center font-medium">
                      <Check className="inline-block w-4 h-4 mr-2" />
                      You voted
                    </div>
                  )}

                  {isHost && (
                    <>
                      <button
                        onClick={() => handleEarlyStart('cancel')}
                        disabled={isVoting}
                        className={cn(
                          'px-4 py-3 rounded-lg transition-colors',
                          'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        Cancel Vote
                      </button>
                      <button
                        onClick={() => handleEarlyStart('force')}
                        disabled={isVoting}
                        className={cn(
                          'px-4 py-3 rounded-lg font-medium transition-colors',
                          'bg-amber-600 text-white hover:bg-amber-700',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        <Play className="inline-block w-4 h-4 mr-1" />
                        Force
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Player list */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-bold text-white mb-4">Registered Players</h2>

          {tournament.registeredPlayers.length === 0 ? (
            <p className="text-zinc-500 text-center py-4">
              No players registered yet
            </p>
          ) : (
            <div className="space-y-2">
              {tournament.registeredPlayers.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">
                    {index + 1}
                  </div>
                  <span className="text-white flex-1 flex items-center gap-2">
                    {player.displayName}
                    {player.id === tournament.creatorId && (
                      <Crown className="w-4 h-4 text-amber-400" />
                    )}
                  </span>
                  {tournament.earlyStart.isVotingActive && (
                    <span className={cn(
                      'text-xs px-2 py-1 rounded',
                      tournament.earlyStart.votes.includes(player.id)
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-700 text-zinc-400'
                    )}>
                      {tournament.earlyStart.votes.includes(player.id) ? 'Voted' : 'Pending'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {tournament.registeredPlayers.length < tournament.maxPlayers && (
            <p className="text-center text-zinc-500 text-sm mt-4">
              Waiting for {tournament.maxPlayers - tournament.registeredPlayers.length} more player(s)...
            </p>
          )}
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Private Tournament</h3>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setError(null);
                }}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-400 text-sm mb-4">
              This tournament is password protected. Enter the password to join.
            </p>

            <form onSubmit={handlePasswordSubmit}>
              <div className="relative mb-4">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  className={cn(
                    'w-full px-4 py-3 pr-12 rounded-lg bg-zinc-800 border',
                    'text-white placeholder-zinc-500',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500',
                    error ? 'border-red-500' : 'border-zinc-700'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-sm mb-4">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPassword('');
                    setError(null);
                  }}
                  className="flex-1 py-3 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering || !password.trim()}
                  className={cn(
                    'flex-1 py-3 rounded-lg font-bold transition-colors',
                    'bg-emerald-600 text-white hover:bg-emerald-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isRegistering ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
