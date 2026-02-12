'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { AtSign, Globe, MapPin, Check, X, ChevronDown } from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { COUNTRIES, STATES } from '@/lib/data/countries';
import {
  validateUsername,
  validateCountry,
  validateState,
} from '@/lib/validation/profile';

export default function SetupPage() {
  return (
    <Suspense>
      <SetupContent />
    </Suspense>
  );
}

function SetupContent() {
  const { update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasStateDropdown = country in STATES;
  const stateList = hasStateDropdown ? STATES[country] : null;

  // Reset state when country changes
  useEffect(() => {
    setState('');
  }, [country]);

  // Debounced username availability check
  const checkUsername = useCallback(async (value: string) => {
    const error = validateUsername(value);
    if (error) {
      setUsernameStatus('invalid');
      setUsernameError(error);
      return;
    }

    setUsernameStatus('checking');
    setUsernameError(null);

    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(value)}`);
      const data = await res.json();

      if (data.available) {
        setUsernameStatus('available');
        setUsernameError(null);
      } else {
        setUsernameStatus('taken');
        setUsernameError(data.error || 'Username is already taken');
      }
    } catch {
      setUsernameStatus('invalid');
      setUsernameError('Failed to check availability');
    }
  }, []);

  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      setUsernameError(null);
      return;
    }

    const timer = setTimeout(() => checkUsername(username), 300);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const isFormValid =
    usernameStatus === 'available' &&
    !validateCountry(country) &&
    !validateState(state);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Final validation
    const errors: Record<string, string | null> = {
      country: validateCountry(country),
      state: validateState(state),
    };
    setFieldErrors(errors);

    if (usernameStatus !== 'available' || Object.values(errors).some(Boolean)) {
      return;
    }

    setIsLoading(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/auth/setup-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, country, state: state.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setUsernameStatus('taken');
          setUsernameError(data.error || 'Username is already taken');
        } else {
          setSubmitError(data.error || 'Failed to set up profile');
        }
        setIsLoading(false);
        return;
      }

      await update();
      window.location.href = callbackUrl;
    } catch {
      setSubmitError('Failed to set up profile. Please try again.');
      setIsLoading(false);
    }
  };

  const inputClasses = (hasError?: boolean) =>
    cn(
      'w-full pl-10 pr-4 py-3 rounded-lg bg-zinc-800 border',
      'text-white placeholder-zinc-500',
      'focus:outline-none focus:ring-2 focus:ring-emerald-500',
      hasError ? 'border-red-500' : 'border-zinc-700'
    );

  const selectTriggerClasses = (hasError?: boolean) =>
    cn(
      'w-full pl-10 pr-10 py-3 rounded-lg bg-zinc-800 border',
      'text-white text-left',
      'focus:outline-none focus:ring-2 focus:ring-emerald-500',
      'data-[placeholder]:text-zinc-500',
      hasError ? 'border-red-500' : 'border-zinc-700'
    );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 -mt-16">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto mb-4">
              <AtSign className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Set Up Your Profile</h2>
            <p className="text-zinc-400 mt-1">
              Choose a username and fill in your details
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Username</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  maxLength={20}
                  autoFocus
                  className={inputClasses(usernameStatus === 'taken' || usernameStatus === 'invalid')}
                />
                {usernameStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {usernameStatus === 'available' && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                )}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && username && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                )}
              </div>
              {usernameError && (
                <p className="mt-1 text-sm text-red-400">{usernameError}</p>
              )}
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Country</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10 pointer-events-none" />
                <Select.Root
                  value={country}
                  onValueChange={(val) => {
                    setCountry(val);
                    setFieldErrors((prev) => ({ ...prev, country: null }));
                  }}
                >
                  <Select.Trigger className={selectTriggerClasses(!!fieldErrors.country)}>
                    <Select.Value placeholder="Select a country" />
                    <Select.Icon className="absolute right-3 top-1/2 -translate-y-1/2">
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50"
                      position="popper"
                      sideOffset={4}
                    >
                      <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-zinc-800 text-zinc-400">
                        <ChevronDown className="w-4 h-4 rotate-180" />
                      </Select.ScrollUpButton>
                      <Select.Viewport className="p-1 max-h-60">
                        {COUNTRIES.map((c) => (
                          <Select.Item
                            key={c.code}
                            value={c.code}
                            className="relative flex items-center px-8 py-2 text-sm text-white rounded cursor-pointer select-none hover:bg-zinc-700 focus:bg-zinc-700 focus:outline-none data-[highlighted]:bg-zinc-700"
                          >
                            <Select.ItemText>{c.name}</Select.ItemText>
                            <Select.ItemIndicator className="absolute left-2">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                      <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-zinc-800 text-zinc-400">
                        <ChevronDown className="w-4 h-4" />
                      </Select.ScrollDownButton>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              {fieldErrors.country && (
                <p className="mt-1 text-sm text-red-400">{fieldErrors.country}</p>
              )}
            </div>

            {/* State/Province */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">State / Province</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10 pointer-events-none" />
                {stateList ? (
                  <Select.Root
                    value={state}
                    onValueChange={(val) => {
                      setState(val);
                      setFieldErrors((prev) => ({ ...prev, state: null }));
                    }}
                  >
                    <Select.Trigger className={selectTriggerClasses(!!fieldErrors.state)}>
                      <Select.Value placeholder="Select a state/province" />
                      <Select.Icon className="absolute right-3 top-1/2 -translate-y-1/2">
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50"
                        position="popper"
                        sideOffset={4}
                      >
                        <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-zinc-800 text-zinc-400">
                          <ChevronDown className="w-4 h-4 rotate-180" />
                        </Select.ScrollUpButton>
                        <Select.Viewport className="p-1 max-h-60">
                          {stateList.map((s) => (
                            <Select.Item
                              key={s.code}
                              value={s.name}
                              className="relative flex items-center px-8 py-2 text-sm text-white rounded cursor-pointer select-none hover:bg-zinc-700 focus:bg-zinc-700 focus:outline-none data-[highlighted]:bg-zinc-700"
                            >
                              <Select.ItemText>{s.name}</Select.ItemText>
                              <Select.ItemIndicator className="absolute left-2">
                                <Check className="w-4 h-4 text-emerald-400" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                        <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-zinc-800 text-zinc-400">
                          <ChevronDown className="w-4 h-4" />
                        </Select.ScrollDownButton>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                ) : (
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, state: null }));
                    }}
                    placeholder="Enter your state/province"
                    maxLength={100}
                    className={inputClasses(!!fieldErrors.state)}
                  />
                )}
              </div>
              {fieldErrors.state && (
                <p className="mt-1 text-sm text-red-400">{fieldErrors.state}</p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-red-400">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              className={cn(
                'w-full px-4 py-3 rounded-lg font-bold',
                'bg-emerald-600 text-white hover:bg-emerald-700',
                'transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? 'Setting up...' : 'Start Playing'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
