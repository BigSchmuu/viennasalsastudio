import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="font-heading text-4xl font-bold">Vienna Salsa Studio</h1>
        <p className="text-muted-foreground text-lg">
          Entdecke unsere Kurse, sieh dir den Stundenplan an oder melde dich an, um dein Abo und deine
          Buchungen zu verwalten.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/kurse">Kurse ansehen</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/stundenplan">Stundenplan ansehen</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
