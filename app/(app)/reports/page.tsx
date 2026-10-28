import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Reports · Karta Lead Tracker" };

// Placeholder proving admin-only access. Real reports arrive in Phase 8.
export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}

async function ReportsContent() {
  await requireRole("admin");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="text-muted-foreground">Admin only. Monthly reports are coming in Phase 8.</p>
      <Button asChild variant="outline" className="self-start">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
