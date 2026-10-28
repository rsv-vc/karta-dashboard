import type { Metadata } from "next";
import { Suspense } from "react";
import { RoleBadge } from "@/components/auth/role-badge";
import { UserAvatar } from "@/components/auth/user-avatar";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { NAV_ITEMS, getNavTitle } from "@/lib/navigation";

export const metadata: Metadata = { title: "Settings · Karta Lead Tracker" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const user = await requireUser();
  return (
    <PageContainer>
      <PageHeader title={getNavTitle("settings")} description={NAV_ITEMS.settings.description} />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <UserAvatar name={user.name} className="size-12" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{user.name}</span>
              <RoleBadge role={user.role} />
            </div>
            <div className="truncate text-sm text-muted-foreground">{user.email}</div>
            <div className="text-sm text-muted-foreground">{user.title}</div>
          </div>
        </CardContent>
      </Card>
      <ComingSoon navKey="settings" features={["Edit profile", "Theme preference", "Notification preferences"]} />
    </PageContainer>
  );
}
