'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ArrowLeft, Users, Coins, Clock, Timer, Lock, Eye, EyeOff, Infinity } from 'lucide-react';
import { usePlayerStore } from '@/stores/player-store';

const PLAYER_COUNTS = [
  { value: 2, label: 'Heads-Up', description: '1v1 battle' },
  { value: 3, label: '3 Players', description: 'Quick three-way' },
  { value: 4, label: '4 Players', description: 'Small group' },
  { value: 5, label: '5 Players', description: 'Nearly full' },
  { value: 6, label: '6 Players', description: 'Full table' },
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
  { value: null, label: '∞', description: 'Unlimited' },
];

export default function CreateTournamentPage() {
  const router = useRouter();
  const { displayName } = usePlayerStore();

  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [startingChips, setStartingChips] = useState(3000);
  const [turnTimerSeconds, setTurnTimerSeconds] = useState<number | null>(30);
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Tournament name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          maxPlayers,
          tableSize: 6, // Always 6-max table
          startingChips,
          turnTimerSeconds,
          password: password.trim() || undefined,
          displayName,
        }),
      });

      const data = await res.json();

      if (data.tournament) {
        router.push(`/play/tournament/${data.tournament.id}`);
      } else {
        setError(data.error || 'Failed to create tournament');
      }
    } catch (err) {
      setError('Failed to create tournament');
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
            <h1 className="text-2xl font-bold text-white">Create Tournament</h1>
            <p className="text-zinc-400">Set up a new Sit & Go</p>
          </div>
        </div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="bg-zinc-900 rounded-xl p-6 border border-zinc-800"
        >
          {/* Tournament name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Tournament Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Night Poker"
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
              Players Needed
            </label>
            <div className="grid grid-cols-5 gap-2">
              {PLAYER_COUNTS.map((count) => (
                <button
                  key={count.value}
                  type="button"
                  onClick={() => setMaxPlayers(count.value)}
                  className={cn(
                    'flex flex-col items-center p-3 rounded-lg border transition-all',
                    maxPlayers === count.value
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  <div className="text-2xl font-bold">{count.value}</div>
                  <div className="text-xs text-zinc-400 text-center">{count.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Starting chips */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <Coins className="inline-block w-4 h-4 mr-1" />
              Starting Stack
            </label>
            <div className="grid grid-cols-3 gap-3">
              {STARTING_STACKS.map((stack) => (
                <button
                  key={stack.value}
                  type="button"
                  onClick={() => setStartingChips(stack.value)}
                  className={cn(
                    'flex flex-col items-center p-4 rounded-lg border transition-all',
                    startingChips === stack.value
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  <div className="text-xl font-bold font-mono">{stack.label}</div>
                  <div className="text-sm text-zinc-400">{stack.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Turn timer */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <Timer className="inline-block w-4 h-4 mr-1" />
              Turn Timer
            </label>
            <div className="grid grid-cols-4 gap-3">
              {TURN_TIMERS.map((timer) => (
                <button
                  key={timer.value ?? 'unlimited'}
                  type="button"
                  onClick={() => setTurnTimerSeconds(timer.value)}
                  className={cn(
                    'flex flex-col items-center p-4 rounded-lg border transition-all',
                    turnTimerSeconds === timer.value
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  <div className="text-xl font-bold font-mono">{timer.label}</div>
                  <div className="text-sm text-zinc-400">{timer.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Password (optional) */}
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

          {/* Info */}
          <div className="mb-6 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
              <Clock className="w-4 h-4" />
              <span>Blind Levels: 10 minutes each</span>
            </div>
            <div className="text-sm text-zinc-500">
              Tournament starts when all {maxPlayers} players join, or the host can start early with 2+ players.
              {maxPlayers >= 3 ? ' Top 2 players win prizes.' : ''}
            </div>
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
            {isSubmitting ? 'Creating...' : 'Create Tournament'}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
