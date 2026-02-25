export const metadata = {
  title: 'Offline',
};

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-2xl font-bold text-white mb-3">You are offline</h1>
      <p className="text-zinc-400 max-w-sm">
        Check your internet connection and try again. Your game state will sync
        automatically when you reconnect.
      </p>
    </div>
  );
}
