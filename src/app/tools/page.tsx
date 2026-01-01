"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Percent, TrendingUp, Target, ArrowRight } from "lucide-react";

const tools = [
  {
    title: "Pot Odds Calculator",
    description: "Calculate if a call is profitable based on pot odds and your equity",
    href: "/tools/pot-odds",
    icon: Percent,
    available: true,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Push/Fold Charts",
    description: "Optimal shoving ranges for short stack tournament play",
    href: "/tools/push-fold",
    icon: Target,
    available: true,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "ICM Calculator",
    description: "Independent Chip Model calculations for tournament decisions",
    href: "/tools/icm",
    icon: TrendingUp,
    available: false,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

export default function ToolsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Math Tools</h1>
        <p className="text-foreground-muted max-w-2xl">
          Pot odds, ICM, and push/fold calculators to make better mathematical decisions at the table.
        </p>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card
              key={tool.title}
              className={`group transition-colors ${tool.available ? "hover:border-zinc-600" : "opacity-60"}`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tool.bgColor}`}>
                    <Icon className={`w-5 h-5 ${tool.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {tool.title}
                      {tool.available && (
                        <ArrowRight className="w-4 h-4 text-foreground-muted group-hover:text-foreground transition-colors" />
                      )}
                    </CardTitle>
                  </div>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {tool.available ? (
                  <Link href={tool.href}>
                    <Button variant="primary" className="w-full">
                      Open Tool
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" disabled className="w-full">
                    Coming Soon
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Pot Odds Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium">2:1 odds</div>
              <div className="text-foreground-muted">Need 33% equity</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">3:1 odds</div>
              <div className="text-foreground-muted">Need 25% equity</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">4:1 odds</div>
              <div className="text-foreground-muted">Need 20% equity</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">5:1 odds</div>
              <div className="text-foreground-muted">Need 17% equity</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Common Outs Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Common Drawing Hands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium">Flush Draw</div>
              <div className="text-foreground-muted">9 outs (~35% by river)</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Open-Ended Straight</div>
              <div className="text-foreground-muted">8 outs (~32% by river)</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Gutshot Straight</div>
              <div className="text-foreground-muted">4 outs (~16% by river)</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Two Overcards</div>
              <div className="text-foreground-muted">6 outs (~24% by river)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
