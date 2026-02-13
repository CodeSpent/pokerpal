import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Play Poker',
    template: '%s | LetsPlay Poker',
  },
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
