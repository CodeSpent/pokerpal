'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useChannel, useChannelEvent } from '@/hooks/usePusher';
import { ArrowLeft, Users, Coins, Clock, Check, Lock, Eye, EyeOff, X, Play, Vote, Crown, Timer } from 'lucide-react';

interface RegisteredPlayer {
  id: string;
  displayName: string;
  isReady?: boolean;
}

interface TournamentDetails {
  id: string;
  name: string;
  status: string;
  registeredPlayers: RegisteredPlayer[];
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
  countdownStartedAt?: number;
}

export default function TournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const playerId = session?.user?.playerId ?? null;
  const displayName = session?.user?.displayName || session?.user?.name || '';

  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  // Countdown state
  const [countdownExpiresAt, setCountdownExpiresAt] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to tournament channel
  const tournamentChannel = useChannel(`tournament-${tournamentId}`);

  // Pusher event handlers
  const handlePlayerRegistered = useCallback((data: {
    playerId: string;
    playerName: string;
    playerCount: number;
    players: RegisteredPlayer[];
  }) => {
    setTournament((prev) => prev ? {
      ...prev,
      registeredPlayers: data.players,
    } : null);
  }, []);

  const handlePlayerUnregistered = useCallback((data: {
    playerId: string;
    playerCount: number;
    players: RegisteredPlayer[];
  }) => {
    setTournament((prev) => prev ? {
      ...prev,
      registeredPlayers: data.players,
    } : null);
  }, []);

  const handleCountdownStarted = useCallback((data: {
    expiresAt: number;
    durationMs: number;
    players: RegisteredPlayer[];
  }) => {
    setCountdownExpiresAt(data.expiresAt);
    setTournament((prev) => prev ? {
      ...prev,
      registeredPlayers: data.players,
    } : null);
    setIsReady(false);
  }, []);

  const handlePlayerReady = useCallback((data: {
    playerId: string;
    readyCount: number;
    playerCount: number;
    allReady: boolean;
    players: RegisteredPlayer[];
  }) => {
    setTournament((prev) => prev ? {
      ...prev,
      registeredPlayers: data.players,
    } : null);
    if (data.playerId === playerId) {
      setIsReady(true);
    }
  }, [playerId]);

  const handleCountdownCancelled = useCallback(() => {
    setCountdownExpiresAt(null);
    setCountdownRemaining(0);
    setIsReady(false);
  }, []);

  const handleGameStarting = useCallback((data: { tableIds: string[] }) => {
    if (data.tableIds.length > 0) {
      router.push(`/play/tournament/${tournamentId}/table/${data.tableIds[0]}`);
    }
  }, [router, tournamentId]);

  // Bind Pusher events
  useChannelEvent(tournamentChannel, 'PLAYER_REGISTERED', handlePlayerRegistered);
  useChannelEvent(tournamentChannel, 'PLAYER_UNREGISTERED', handlePlayerUnregistered);
  useChannelEvent(tournamentChannel, 'COUNTDOWN_STARTED', handleCountdownStarted);
  useChannelEvent(tournamentChannel, 'PLAYER_READY', handlePlayerReady);
  useChannelEvent(tournamentChannel, 'COUNTDOWN_CANCELLED', handleCountdownCancelled);
  useChannelEvent(tournamentChannel, 'GAME_STARTING', handleGameStarting);

  // Countdown timer effect
  useEffect(() => {
    if (!countdownExpiresAt) {
      setCountdownRemaining(0);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, countdownExpiresAt - now);
      setCountdownRemaining(remaining);

      if (remaining <= 0) {
        fetch(`/api/tournaments/${tournamentId}/countdown`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'expire' }),
        }).catch(console.error);
      }
    };

    updateCountdown();
    countdownTimerRef.current = setInterval(updateCountdown, 100);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [countdownExpiresAt, tournamentId]);

  // Fetch tournament details (initial load)
  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}`);
        const data = await res.json();

        if (data.tournament) {
          setTournament(data.tournament);

          // Check if current player is registered
          if (playerId) {
            const registered = data.tournament.registeredPlayers.some(
              (p: { id: string }) => p.id === playerId
            );
            setIsRegistered(registered);

            const playerData = data.tournament.registeredPlayers.find(
              (p: RegisteredPlayer) => p.id === playerId
            );
            if (playerData?.isReady) {
              setIsReady(true);
            }
          }

          // If tournament has active countdown, set it
          if (data.tournament.countdownStartedAt) {
            const expiresAt = data.tournament.countdownStartedAt + 20000;
            if (expiresAt > Date.now()) {
              setCountdownExpiresAt(expiresAt);
            }
          }

          // If tournament started and we're registered, navigate to table
          if (data.tournament.status === 'running' && data.tournament.tables.length > 0) {
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
  }, [tournamentId, router, playerId]);

  const handleRegister = async (providedPassword?: string) => {
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
          password: providedPassword || undefined,
        }),
      });

      const data = await res.json();

      if (data.registered) {
        setIsRegistered(true);
        setShowPasswordModal(false);
        setPassword('');

        if (data.tournamentStarted && data.tables?.length > 0) {
          router.push(`/play/tournament/${tournamentId}/table/${data.tables[0]}`);
        }
      } else if (data.requiresPassword) {
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
      if (action === 'force' || action === 'initiate') {
        const res = await fetch(`/api/tournaments/${tournamentId}/countdown`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        });

        const data = await res.json();

        if (data.countdownStarted) {
          setCountdownExpiresAt(data.expiresAt);
        } else if (data.error) {
          setError(data.error);
        }
      } else {
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
      }
    } catch (err) {
      setError('Failed to process request');
    } finally {
      setIsVoting(false);
    }
  };

  const handleReady = async () => {
    setIsMarkingReady(true);
    setError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (data.ready) {
        setIsReady(true);
        if (data.tournamentStarted && data.tables?.length > 0) {
          router.push(`/play/tournament/${tournamentId}/table/${data.tables[0]}`);
        }
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to mark ready');
    } finally {
      setIsMarkingReady(false);
    }
  };

  const isHost = playerId === tournament?.creatorId;
  const hasVoted = tournament?.earlyStart.votes.includes(playerId || '');
  const canStartEarly = tournament && tournament.registeredPlayers.length >= 2;
  const isCountdownActive = countdownExpiresAt !== null && countdownRemaining > 0;
  const countdownSeconds = Math.ceil(countdownRemaining / 1000);
  const readyCount = tournament?.registeredPlayers.filter(p => p.isReady).length ?? 0;

  const isCurrentPlayer = (playerIdToCheck: string) => {
    return playerId !== null && playerIdToCheck === playerId;
  };

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
              {isCountdownActive ? (
                <>
                  <div className="text-xs text-amber-400 mb-1">Starting in</div>
                  <div className="flex items-center justify-center gap-1 text-amber-400">
                    <Timer className="w-4 h-4" />
                    <span className="font-mono text-lg font-bold">{countdownSeconds}s</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-zinc-500 mb-1">Blind Levels</div>
                  <div className="flex items-center justify-center gap-1 text-white">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="font-mono text-lg">10 min</span>
                  </div>
                </>
              )}
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
              {!isCountdownActive && (
                <button
                  onClick={handleUnregister}
                  disabled={isRegistering}
                  className="px-4 py-3 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                >
                  Leave
                </button>
              )}
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


        {/* Early Start Controls */}
        {isRegistered && tournament.registeredPlayers.length < tournament.maxPlayers && canStartEarly && !isCountdownActive && (
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
              <>
                {isHost ? (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-400">
                      As the host, you can start the tournament early with the current players.
                    </p>
                    <button
                      onClick={() => handleEarlyStart('force')}
                      disabled={isVoting}
                      className={cn(
                        'w-full py-3 rounded-lg font-medium transition-colors',
                        'bg-emerald-600 text-white hover:bg-emerald-700',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <Play className="inline-block w-4 h-4 mr-2" />
                      {isVoting ? 'Starting...' : 'Start Tournament'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">
                    The host can start the tournament early once 2 or more players have joined.
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-300">
                    Vote to start with {tournament.registeredPlayers.length} players
                  </p>
                  <span className="text-sm font-mono text-amber-400">
                    {tournament.earlyStart.votes.length}/{tournament.registeredPlayers.length} votes
                  </span>
                </div>

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
                  {isCountdownActive && (
                    isCurrentPlayer(player.id) ? (
                      player.isReady || isReady ? (
                        <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                          Ready
                        </span>
                      ) : (
                        <button
                          onClick={handleReady}
                          disabled={isMarkingReady}
                          className={cn(
                            'text-xs px-3 py-1 rounded transition-colors',
                            'bg-emerald-600 text-white hover:bg-emerald-500',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        >
                          {isMarkingReady ? '...' : 'Ready'}
                        </button>
                      )
                    ) : (
                      <span className={cn(
                        'text-xs px-2 py-1 rounded',
                        player.isReady
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-700 text-zinc-400'
                      )}>
                        {player.isReady ? 'Ready' : 'Waiting'}
                      </span>
                    )
                  )}
                  {!isCountdownActive && tournament.earlyStart.isVotingActive && (
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
