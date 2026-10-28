import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder home page until the app shell lands in a later phase.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Karta Lead Tracker</h1>
      <p className="text-muted-foreground">Phase 1: data model and mock data.</p>
      <Button asChild>
        <Link href="/dev/data">Open data check page</Link>
      </Button>
    </main>
  );
}
