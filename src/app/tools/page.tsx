"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Percent, TrendingUp, Target, Construction } from "lucide-react";

const tools = [
  {
    title: "Pot Odds Calculator",
    description: "Calculate if a call is profitable based on pot odds and equity",
    href: "/tools/pot-odds",
    icon: Percent,
    available: false,
  },
  {
    title: "ICM Calculator",
    description: "Independent Chip Model calculations for tournament decisions",
    href: "/tools/icm",
    icon: TrendingUp,
    available: false,
  },
  {
    title: "Push/Fold Charts",
    description: "Optimal shoving and calling ranges for short stacks",
    href: "/tools/push-fold",
    icon: Target,
    available: false,
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

      {/* Coming Soon Notice */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-center gap-4 py-4">
          <Construction className="w-6 h-6 text-amber-500" />
          <div>
            <p className="font-medium">Coming Soon</p>
            <p className="text-sm text-foreground-muted">
              Math tools are under development. Check back soon!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Card key={tool.title} className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Icon className="w-5 h-5 text-amber-500" />
                  </div>
                  <CardTitle className="text-lg">{tool.title}</CardTitle>
                </div>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled className="w-full">
                  Coming Soon
                </Button>
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
    </div>
  );
}
