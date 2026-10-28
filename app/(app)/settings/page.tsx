import type { Metadata } from "next";
import { Suspense } from "react";
import { RoleBadge } from "@/components/auth/role-badge";
import { UserAvatar } from "@/components/auth/user-avatar";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you appear to the team. Ask an admin to change your email or access.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <UserAvatar name={user.name} className="size-12" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{user.name}</span>
                  <RoleBadge role={user.role} />
                </div>
                <div className="truncate text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <ProfileForm initial={{ name: user.name, title: user.title }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Forgot it? An admin can give you a temporary password from the Team page.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
