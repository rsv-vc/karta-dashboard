import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Lead directory · Karta Lead Tracker" };

export default function DirectoryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DirectoryContent />
    </Suspense>
  );
}

async function DirectoryContent() {
  const user = await requireUser();

  // Admins see every lead in full, so the masked directory adds nothing for them.
  if (isAdmin(user)) {
    return (
      <PageContainer>
        <PageHeader title={getNavTitle("directory")} />
        <div className="flex flex-col items-start gap-3 rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">
            You already see every lead in full. The directory is the masked view sales agents use.
          </p>
          <Button asChild variant="outline">
            <Link href="/leads">Go to all leads</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={getNavTitle("directory")} description={NAV_ITEMS.directory.description} />
      <ComingSoon
        navKey="directory"
        features={[
          "Every company in the pipeline with its POC, owner and stage",
          "Contact details and deal values stay hidden",
          "Quick search before you add a new lead",
        ]}
      />
    </PageContainer>
  );
}
