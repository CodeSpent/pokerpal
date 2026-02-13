'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ArrowLeft, Users, Coins, Clock, Timer, Lock, Eye, EyeOff, DollarSign } from 'lucide-react';

const PLAYER_COUNTS = [
  { value: 2, label: 'Heads-Up' },
  { value: 3, label: '3 Max' },
  { value: 4, label: '4 Max' },
  { value: 5, label: '5 Max' },
  { value: 6, label: '6 Max' },
];

const STARTING_STACKS = [
  { value: 1500, label: '1,500', description: 'Turbo' },
  { value: 3000, label: '3,000', description: 'Standard' },
  { value: 5000, label: '5,000', description: 'Deep Stack' },
];

const TURN_TIMERS = [
  { value: 30, label: '30s', description: 'Fast' },
  { value: 60, label: '60s', description: 'Standard' },
  { value: 120, label: '2 min', description: 'Relaxed' },
  { value: null, label: '\u221E', description: 'Unlimited' },
];

const BLIND_PRESETS = [
  { sb: 10, bb: 20, label: '10/20' },
  { sb: 25, bb: 50, label: '25/50' },
  { sb: 50, bb: 100, label: '50/100' },
];

export default function CreateGamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [gameType, setGameType] = useState<'tournament' | 'cash'>(
    searchParams.get('type') === 'cash' ? 'cash' : 'tournament'
  );

  // Shared fields
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [turnTimerSeconds, setTurnTimerSeconds] = useState<number | null>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tournament fields
  const [startingChips, setStartingChips] = useState(3000);
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Cash game fields
  const [selectedBlinds, setSelectedBlinds] = useState(0); // index into BLIND_PRESETS
  const [minBuyIn, setMinBuyIn] = useState(400);
  const [maxBuyIn, setMaxBuyIn] = useState(2000);

  // Auto-update buy-in defaults when blinds change
  const handleBlindsChange = (idx: number) => {
    setSelectedBlinds(idx);
    const preset = BLIND_PRESETS[idx];
    setMinBuyIn(preset.bb * 20);
    setMaxBuyIn(preset.bb * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(`${gameType === 'cash' ? 'Game' : 'Tournament'} name is required`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (gameType === 'cash') {
        const blinds = BLIND_PRESETS[selectedBlinds];
        const res = await fetch('/api/cash-games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            maxPlayers,
            tableSize: 6,
            smallBlind: blinds.sb,
            bigBlind: blinds.bb,
            minBuyIn,
            maxBuyIn,
            turnTimerSeconds,
          }),
        });

        const data = await res.json();
        if (data.cashGame) {
          router.push(`/play/cash/${data.cashGame.id}`);
        } else {
          setError(data.error || 'Failed to create cash game');
        }
      } else {
        const res = await fetch('/api/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            maxPlayers,
            tableSize: 6,
            startingChips,
            turnTimerSeconds,
            password: password.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (data.tournament) {
          router.push(`/play/tournament/${data.tournament.id}`);
        } else {
          setError(data.error || 'Failed to create tournament');
        }
      }
    } catch {
      setError(`Failed to create ${gameType === 'cash' ? 'cash game' : 'tournament'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-white">
              {gameType === 'cash' ? 'Create Cash Game' : 'Create Tournament'}
            </h1>
            <p className="text-zinc-400">
              {gameType === 'cash' ? 'Set up a cash game table' : 'Set up a new Sit & Go'}
            </p>
          </div>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-zinc-900 rounded-xl p-4 sm:p-6 border border-zinc-800"
        >
          {/* Game Type Toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Game Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGameType('tournament')}
                className={cn(
                  'flex flex-col items-center p-3 rounded-lg border transition-all',
                  gameType === 'tournament'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                )}
              >
                <div className="text-lg font-bold">Tournament</div>
                <div className="text-xs text-zinc-400">Sit & Go format</div>
              </button>
              <button
                type="button"
                onClick={() => setGameType('cash')}
                className={cn(
                  'flex flex-col items-center p-3 rounded-lg border transition-all',
                  gameType === 'cash'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                )}
              >
                <div className="text-lg font-bold">Cash Game</div>
                <div className="text-xs text-zinc-400">Fixed blinds, rebuy</div>
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              {gameType === 'cash' ? 'Table Name' : 'Tournament Name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={gameType === 'cash' ? 'Friday Night Cash' : 'Friday Night Poker'}
              maxLength={50}
              className={cn(
                'w-full px-4 py-3 rounded-lg bg-zinc-800 border',
                'text-white placeholder-zinc-500',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500',
                'border-zinc-700'
              )}
            />
          </div>

          {/* Player count */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <Users className="inline-block w-4 h-4 mr-1" />
              {gameType === 'cash' ? 'Max Players' : 'Players Needed'}
            </label>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {PLAYER_COUNTS.map((count) => (
                <button
                  key={count.value}
                  type="button"
                  onClick={() => setMaxPlayers(count.value)}
                  className={cn(
                    'flex flex-col items-center p-2 sm:p-3 rounded-lg border transition-all',
                    maxPlayers === count.value
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  <div className="text-xl sm:text-2xl font-bold">{count.value}</div>
                  <div className="text-[10px] sm:text-xs text-zinc-400 whitespace-nowrap">{count.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tournament: Starting chips */}
          {gameType === 'tournament' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                <Coins className="inline-block w-4 h-4 mr-1" />
                Starting Stack
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                {STARTING_STACKS.map((stack) => (
                  <button
                    key={stack.value}
                    type="button"
                    onClick={() => setStartingChips(stack.value)}
                    className={cn(
                      'flex flex-col items-center p-3 sm:p-4 rounded-lg border transition-all',
                      startingChips === stack.value
                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    )}
                  >
                    <div className="text-lg sm:text-xl font-bold font-mono whitespace-nowrap">{stack.label}</div>
                    <div className="text-xs sm:text-sm text-zinc-400 whitespace-nowrap">{stack.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cash Game: Blinds */}
          {gameType === 'cash' && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  <DollarSign className="inline-block w-4 h-4 mr-1" />
                  Blinds (SB/BB)
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                  {BLIND_PRESETS.map((preset, idx) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleBlindsChange(idx)}
                      className={cn(
                        'flex flex-col items-center p-3 sm:p-4 rounded-lg border transition-all',
                        selectedBlinds === idx
                          ? 'bg-emerald-600/20 border-emerald-500 text-white'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                      )}
                    >
                      <div className="text-lg sm:text-xl font-bold font-mono">{preset.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Buy-in Range */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  <Coins className="inline-block w-4 h-4 mr-1" />
                  Buy-in Range
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Min Buy-in</label>
                    <input
                      type="number"
                      value={minBuyIn}
                      onChange={(e) => setMinBuyIn(Number(e.target.value))}
                      min={1}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg bg-zinc-800 border',
                        'text-white font-mono',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-500',
                        'border-zinc-700'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Max Buy-in</label>
                    <input
                      type="number"
                      value={maxBuyIn}
                      onChange={(e) => setMaxBuyIn(Number(e.target.value))}
                      min={minBuyIn}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg bg-zinc-800 border',
                        'text-white font-mono',
                        'focus:outline-none focus:ring-2 focus:ring-emerald-500',
                        'border-zinc-700'
                      )}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Default: {BLIND_PRESETS[selectedBlinds].bb * 20} (20BB) - {BLIND_PRESETS[selectedBlinds].bb * 100} (100BB)
                </p>
              </div>
            </>
          )}

          {/* Turn timer */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <Timer className="inline-block w-4 h-4 mr-1" />
              Turn Timer
            </label>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
              {TURN_TIMERS.map((timer) => (
                <button
                  key={timer.value ?? 'unlimited'}
                  type="button"
                  onClick={() => setTurnTimerSeconds(timer.value)}
                  className={cn(
                    'flex flex-col items-center p-3 sm:p-4 rounded-lg border transition-all',
                    turnTimerSeconds === timer.value
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  <div className="text-lg sm:text-xl font-bold font-mono whitespace-nowrap">{timer.label}</div>
                  <div className="text-xs sm:text-sm text-zinc-400 whitespace-nowrap">{timer.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tournament: Password */}
          {gameType === 'tournament' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-zinc-300">
                  <Lock className="inline-block w-4 h-4 mr-1" />
                  Password Protection
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRequirePassword(!requirePassword);
                    if (requirePassword) setPassword('');
                  }}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    requirePassword ? 'bg-emerald-600' : 'bg-zinc-700'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      requirePassword ? 'translate-x-6' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={requirePassword ? 'Enter password' : 'No password required'}
                  maxLength={20}
                  autoComplete="off"
                  disabled={!requirePassword}
                  data-1p-ignore
                  data-lpignore="true"
                  className={cn(
                    'w-full px-4 py-3 pr-12 rounded-lg bg-zinc-800 border',
                    'text-white placeholder-zinc-500',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500',
                    'border-zinc-700',
                    !requirePassword && 'opacity-50 cursor-not-allowed'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={!requirePassword}
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300',
                    !requirePassword && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {requirePassword && password && password.length < 4 && (
                <p className="mt-1 text-xs text-amber-400">
                  Password must be at least 4 characters
                </p>
              )}
            </div>
          )}

          {/* Info */}
          <div className="mb-6 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
            {gameType === 'tournament' ? (
              <>
                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                  <Clock className="w-4 h-4" />
                  <span>Blind Levels: 10 minutes each</span>
                </div>
                <div className="text-sm text-zinc-500">
                  Tournament starts when all {maxPlayers} players join, or the host can start early with 2+ players.
                  {maxPlayers >= 3 ? ' Top 2 players win prizes.' : ''}
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-500">
                Fixed blinds ({BLIND_PRESETS[selectedBlinds].label}). Players can join anytime,
                rebuy when low on chips, and cash out when they leave. Game runs until the host closes it.
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'w-full py-3 rounded-lg font-bold transition-colors',
              'bg-emerald-600 text-white hover:bg-emerald-700',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSubmitting
              ? 'Creating...'
              : gameType === 'cash'
              ? 'Create Cash Game'
              : 'Create Tournament'}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
