import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { playerRepo } from '@/lib/db/repositories';
import { validateUsername } from '@/lib/validation/profile';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') ?? '';

    const validationError = validateUsername(username);
    if (validationError) {
      return NextResponse.json({ available: false, error: validationError });
    }

    const existing = await playerRepo.getPlayerByName(username);
    return NextResponse.json({ available: !existing });
  } catch (error) {
    console.error('Check username error:', error);
    return NextResponse.json(
      { error: 'Failed to check username' },
      { status: 500 }
    );
  }
}
