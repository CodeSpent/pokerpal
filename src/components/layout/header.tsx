"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { BookOpen, Grid3X3, Dices, Calculator, Menu, X, Gamepad2, LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Play", href: "/play", icon: Gamepad2, highlight: true },
  { name: "PreFlop", href: "/preflop", icon: BookOpen },
  { name: "Ranges", href: "/ranges", icon: Grid3X3 },
  { name: "Scenarios", href: "/scenarios", icon: Dices },
  { name: "Tools", href: "/tools", icon: Calculator },
];

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-medium tracking-widest text-emerald-400 uppercase">LetsPlay</span>
            <span className="text-xl font-black tracking-tight text-white">POKER</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            const isHighlight = 'highlight' in item && item.highlight;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  isHighlight && !isActive
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : isActive
                    ? "bg-zinc-800 text-foreground"
                    : "text-foreground-muted hover:text-foreground hover:bg-zinc-800/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Auth + Mobile Menu */}
        <div className="flex items-center gap-2">
          {/* Auth UI (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            {session?.user ? (
              <>
                <span className="text-sm text-zinc-300">
                  {session.user.displayName || session.user.name || session.user.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-zinc-400 hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Link
                href="/auth/signin"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  "bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"
                )}
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-background">
          <div className="container mx-auto px-4 py-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-zinc-800 text-foreground"
                      : "text-foreground-muted hover:text-foreground hover:bg-zinc-800/50"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* Auth (mobile) */}
            <div className="border-t border-zinc-800 pt-2 mt-2">
              {session?.user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut({ callbackUrl: '/' });
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-zinc-800/50 w-full"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out ({session.user.displayName || session.user.email})
                </button>
              ) : (
                <Link
                  href="/auth/signin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-zinc-800/50"
                >
                  <LogIn className="w-5 h-5" />
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
