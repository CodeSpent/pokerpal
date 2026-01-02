"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Grid3X3, Dices, Calculator, Menu, X, Gamepad2 } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            {/* Poker chip */}
            <div className="absolute inset-0 rounded-full bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-black text-lg">P</span>
            </div>
            {/* Chip notches */}
            <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-emerald-400/60" />
            <div className="absolute inset-[3px] rounded-full border-2 border-emerald-300/30" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
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

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
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
          </div>
        </div>
      )}
    </header>
  );
}
