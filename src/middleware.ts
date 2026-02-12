import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Only protect /play/* routes
  if (!pathname.startsWith('/play')) {
    return NextResponse.next();
  }

  // Not authenticated -> redirect to sign-in
  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Authenticated but no player record -> redirect to setup
  if (!req.auth.user?.playerId) {
    const setupUrl = new URL('/auth/setup', req.url);
    return NextResponse.redirect(setupUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/play/:path*'],
};
