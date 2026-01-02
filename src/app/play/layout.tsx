import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Play Poker - Letsplay.poker',
  description: 'Join a tournament and play real-time multiplayer poker',
};

export default function PlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      {children}
    </div>
  );
}
