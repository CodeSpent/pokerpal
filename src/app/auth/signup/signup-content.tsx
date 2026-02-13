'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setIsLoading(false);
        return;
      }

      // Auto sign-in after registration
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl: '/play',
        redirect: false,
      });

      if (result?.error) {
        setError('Account created but sign-in failed. Please sign in manually.');
        setIsLoading(false);
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError('Registration failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 -mt-16">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex flex-col items-center leading-none mb-2">
            <span className="text-xs font-medium tracking-widest text-emerald-400 uppercase">LetsPlay</span>
            <span className="text-3xl font-black tracking-tight text-white">POKER</span>
          </div>
          <p className="text-zinc-400">Create your account</p>
        </div>

        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className={cn(
                    'w-full pl-11 pr-4 py-3 rounded-lg bg-zinc-800 border',
                    'text-white placeholder-zinc-500',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500',
                    'border-zinc-700'
                  )}
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min 8 characters)"
                  required
                  className={cn(
                    'w-full pl-11 pr-12 py-3 rounded-lg bg-zinc-800 border',
                    'text-white placeholder-zinc-500',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500',
                    'border-zinc-700'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                  className={cn(
                    'w-full pl-11 pr-4 py-3 rounded-lg bg-zinc-800 border',
                    'text-white placeholder-zinc-500',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500',
                    'border-zinc-700'
                  )}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-3 rounded-lg font-bold transition-colors',
                'bg-emerald-600 text-white hover:bg-emerald-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-zinc-400">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-emerald-400 hover:text-emerald-300">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
