'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useChannel, useChannelEvent } from '@/hooks/usePusher';
import { ArrowLeft, Users, Coins, DollarSign, LogOut, X } from 'lucide-react';

interface CashGameDetails {
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  creatorId: string;
}

interface SeatedPlayer {
  id: string;
  name: string;
  avatar: string | null;
  seatIndex: number;
  stack: number;
  status: string;
}

export default function CashGameContent({
  params,
}: {
  params: Promise<{ cashGameId: string }>;
}) {
  const { cashGameId } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const playerId = session?.user?.playerId ?? null;

  const [game, setGame] = useState<CashGameDetails | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [players, setPlayers] = useState<SeatedPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isSeated = players.some((p) => p.id === playerId);
  const isHost = game?.creatorId === playerId;

  // Subscribe to cash game channel
  const cashGameChannel = useChannel(`cash-game-${cashGameId}`);

  const handlePlayerJoined = useCallback(() => {
    fetchGameDetails();
  }, []);

  const handlePlayerLeft = useCallback(() => {
    fetchGameDetails();
  }, []);

  const handleGameClosed = useCallback(() => {
    fetchGameDetails();
  }, []);

  useChannelEvent(cashGameChannel, 'PLAYER_JOINED', handlePlayerJoined);
  useChannelEvent(cashGameChannel, 'PLAYER_LEFT', handlePlayerLeft);
  useChannelEvent(cashGameChannel, 'CASH_GAME_CLOSED', handleGameClosed);

  const fetchGameDetails = async () => {
    try {
      const res = await fetch(`/api/cash-games/${cashGameId}`);
      const data = await res.json();
      if (data.cashGame) {
        setGame(data.cashGame);
        setTableId(data.table?.id ?? null);
        setPlayers(data.players || []);
        if (buyInAmount === 0 && data.cashGame.minBuyIn) {
          setBuyInAmount(data.cashGame.maxBuyIn);
        }
      }
    } catch (err) {
      console.error('Failed to fetch cash game:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGameDetails();
  }, [cashGameId]);

  const handleJoin = async () => {
    if (!game) return;
    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/cash-games/${cashGameId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyInAmount }),
      });

      const data = await res.json();
      if (data.success && data.tableId) {
        router.push(`/play/cash/${cashGameId}/table/${data.tableId}`);
      } else {
        setError(data.error || 'Failed to join');
      }
    } catch {
      setError('Failed to join cash game');
    } finally {
      setIsJoining(false);
    }
  };

  const handleClose = async () => {
    setIsClosing(true);
    setError(null);

    try {
      const res = await fetch(`/api/cash-games/${cashGameId}/close`, {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        router.push('/play?tab=cash');
      } else {
        setError(data.error || 'Failed to close game');
      }
    } catch {
      setError('Failed to close game');
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-zinc-400">Loading cash game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Game Not Found</h2>
          <Link href="/play?tab=cash" className="text-emerald-400 hover:underline">
            Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  if (game.status === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <X className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Game Closed</h2>
          <p className="text-zinc-400 mb-4">This cash game has been closed by the host.</p>
          <Link
            href="/play?tab=cash"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            Back to Lobby
          </Link>
        </div>
      </div>
    );
  }

  // If player is already seated, redirect to table
  if (isSeated && tableId) {
    router.push(`/play/cash/${cashGameId}/table/${tableId}`);
    return null;
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/play?tab=cash"
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{game.name}</h1>
            <p className="text-zinc-400">
              {game.smallBlind}/{game.bigBlind} Cash Game
            </p>
          </div>
        </div>

        {/* Game Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 mb-6"
        >
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Blinds</div>
              <div className="flex items-center gap-1 text-white">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="font-mono">{game.smallBlind}/{game.bigBlind}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Buy-in Range</div>
              <div className="flex items-center gap-1 text-white">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-sm">
                  {game.minBuyIn.toLocaleString()}-{game.maxBuyIn.toLocaleString()}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Players</div>
              <div className="flex items-center gap-1 text-white">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="font-mono">
                  {players.length} / {game.maxPlayers}
                </span>
              </div>
            </div>
          </div>

          {/* Seated Players */}
          {players.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Seated Players</h3>
              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{p.name}</span>
                    </div>
                    <span className="text-emerald-400 font-mono">
                      {p.stack.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Join Section */}
          {!isSeated && playerId && (
            <div className="border-t border-zinc-700 pt-6">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Buy-in Amount
              </label>
              <input
                type="range"
                min={game.minBuyIn}
                max={game.maxBuyIn}
                step={game.bigBlind}
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(Number(e.target.value))}
                className="w-full mb-2 accent-emerald-500"
              />
              <div className="flex justify-between text-sm text-zinc-400 mb-4">
                <span>{game.minBuyIn.toLocaleString()}</span>
                <span className="text-white font-mono font-bold text-lg">
                  {buyInAmount.toLocaleString()}
                </span>
                <span>{game.maxBuyIn.toLocaleString()}</span>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={isJoining || players.length >= game.maxPlayers}
                className={cn(
                  'w-full py-3 rounded-lg font-bold transition-colors',
                  'bg-emerald-600 text-white hover:bg-emerald-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isJoining ? 'Joining...' : `Join Table (${buyInAmount.toLocaleString()} chips)`}
              </button>
            </div>
          )}

          {/* Host Close Button */}
          {isHost && (
            <div className="border-t border-zinc-700 pt-4 mt-4">
              <button
                onClick={handleClose}
                disabled={isClosing}
                className={cn(
                  'w-full py-3 rounded-lg font-bold transition-colors',
                  'bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600/30',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <LogOut className="inline-block w-4 h-4 mr-2" />
                {isClosing ? 'Closing...' : 'Close Game'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
