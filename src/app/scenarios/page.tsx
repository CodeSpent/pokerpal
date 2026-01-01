"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dices, PlayCircle, Upload, BarChart3, Construction } from "lucide-react";

const features = [
  {
    title: "Quiz Mode",
    description: "Test your decision-making with randomized poker scenarios",
    href: "/scenarios/quiz",
    icon: Dices,
    available: false,
  },
  {
    title: "Hand Replayer",
    description: "Step through hands with decision points and explanations",
    href: "/scenarios/replayer",
    icon: PlayCircle,
    available: false,
  },
  {
    title: "Import Hands",
    description: "Import hand histories from PokerStars or GGPoker",
    href: "/scenarios/import",
    icon: Upload,
    available: false,
  },
  {
    title: "Statistics",
    description: "Track your performance and improvement over time",
    href: "/scenarios",
    icon: BarChart3,
    available: false,
  },
];

export default function ScenariosPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Scenarios</h1>
        <p className="text-foreground-muted max-w-2xl">
          Practice poker decisions with quiz-style scenarios, replay hands, and track your improvement.
        </p>
      </div>

      {/* Coming Soon Notice */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-center gap-4 py-4">
          <Construction className="w-6 h-6 text-amber-500" />
          <div>
            <p className="font-medium">Coming Soon</p>
            <p className="text-sm text-foreground-muted">
              Scenario training features are under development. Check back soon!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title} className="opacity-60">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Icon className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </div>
                </div>
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

      {/* Preview of Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Your Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground-muted">
            Complete scenarios to track your improvement over time.
            Statistics will appear here once you start practicing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
