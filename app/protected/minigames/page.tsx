import { requireUsername } from "@/lib/auth-utils";
import Link from "next/link";
import { Timer } from "lucide-react";

export default async function MinigamesPage() {
  await requireUsername();

  const games = [
    {
      id: "quiz-rush",
      name: "Quiz Rush",
      description: "Answer as many questions as you can in 60 seconds with a maximum of 3 wrong answers.",
      icon: Timer,
      href: "/protected/minigames/quiz-rush",
      color: "text-[hsl(var(--primary))]",
    },
  ];

  return (
    <div className="min-h-screen pb-20 px-4 py-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">Minigames</h1>
      </header>

      <div className="grid gap-4">
        {games.map((game) => {
          const Icon = game.icon;
          return (
            <Link
              key={game.id}
              href={game.href}
              className="block p-6 border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 ${game.color}`}>
                  <Icon className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-foreground mb-2">{game.name}</h2>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{game.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
