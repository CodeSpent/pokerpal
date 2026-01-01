import Link from "next/link";
import { BookOpen, Grid3X3, Dices, Calculator } from "lucide-react";

const features = [
  {
    title: "PreFlop Strategy",
    description: "Master position-based opening ranges with interactive charts and decision practice",
    href: "/preflop",
    icon: BookOpen,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Range Finder",
    description: "Build, customize, and save hand ranges for any situation",
    href: "/ranges",
    icon: Grid3X3,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Scenarios",
    description: "Test your skills with quiz-style decisions and hand replays",
    href: "/scenarios",
    icon: Dices,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Math Tools",
    description: "Pot odds, ICM, and push/fold calculators at your fingertips",
    href: "/tools",
    icon: Calculator,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-4 py-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Master Texas Hold&apos;em
        </h1>
        <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
          Improve your poker game with preflop charts, range analysis, scenario training, and math tools.
          From beginner fundamentals to advanced strategy.
        </p>
      </section>

      {/* Feature Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="group p-6 rounded-xl bg-background-secondary border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${feature.bgColor}`}>
                  <Icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold group-hover:text-accent-primary transition-colors">
                    {feature.title}
                  </h2>
                  <p className="text-foreground-muted">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Quick Stats (placeholder for future) */}
      <section className="p-6 rounded-xl bg-background-secondary border border-zinc-800">
        <h2 className="text-lg font-semibold mb-4">Your Progress</h2>
        <p className="text-foreground-muted">
          Start practicing to track your improvement over time.
        </p>
      </section>
    </div>
  );
}
