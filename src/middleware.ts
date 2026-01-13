import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PLAYER_COOKIE_NAME = 'pokerpal-player-id';
const PLAYER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Middleware to handle anonymous player identity
 *
 * - Generates a UUID for new visitors
 * - Stores it in an HttpOnly cookie
 * - Only applies to /play/* routes (multiplayer section)
 */
export function middleware(request: NextRequest) {
  // Only apply to multiplayer routes
  if (!request.nextUrl.pathname.startsWith('/play')) {
    return NextResponse.next();
  }

  // Check if player already has an ID
  const existingPlayerId = request.cookies.get(PLAYER_COOKIE_NAME)?.value;

  if (existingPlayerId) {
    // Player exists, continue normally
    return NextResponse.next();
  }

  // Generate new player ID
  const newPlayerId = crypto.randomUUID();

  // Create response with cookie
  const response = NextResponse.next();

  response.cookies.set(PLAYER_COOKIE_NAME, newPlayerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PLAYER_COOKIE_MAX_AGE,
    path: '/',
  });

  return response;
}

export const config = {
  matcher: ['/play/:path*'],
};
