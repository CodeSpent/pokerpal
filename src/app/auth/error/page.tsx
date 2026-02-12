'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { AlertTriangle } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration.',
  AccessDenied: 'Access denied. You do not have permission to sign in.',
  Verification: 'The verification link has expired or has already been used.',
  OAuthSignin: 'Error starting the OAuth sign-in flow.',
  OAuthCallback: 'Error handling the OAuth callback.',
  OAuthCreateAccount: 'Could not create an account with this OAuth provider.',
  EmailCreateAccount: 'Could not create an account with this email.',
  Callback: 'Error in the authentication callback.',
  OAuthAccountNotLinked: 'This email is already associated with another sign-in method. Please use your original sign-in method.',
  CredentialsSignin: 'Invalid email or password.',
  Default: 'An authentication error occurred.',
};

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error') || 'Default';
  const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 -mt-16">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md text-center"
      >
        <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Authentication Error</h1>
          <p className="text-zinc-400 mb-6">{message}</p>
          <Link
            href="/auth/signin"
            className={cn(
              'inline-flex px-6 py-3 rounded-lg font-bold transition-colors',
              'bg-emerald-600 text-white hover:bg-emerald-700'
            )}
          >
            Try Again
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
