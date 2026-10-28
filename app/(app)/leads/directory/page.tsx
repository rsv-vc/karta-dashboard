import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { DirectoryTable } from "@/components/leads/directory-table";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { isAdmin } from "@/lib/auth/permissions";
import { getDirectoryRows, getOwnerOptions } from "@/lib/data/leads";
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

  const [rows, ownerOptions] = await Promise.all([getDirectoryRows(), getOwnerOptions()]);
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("directory")} description={NAV_ITEMS.directory.description} />
      <DirectoryTable rows={rows} ownerOptions={ownerOptions} />
    </PageContainer>
  );
}
