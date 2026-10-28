import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SetPasswordForm } from "@/components/settings/set-password-form";
import { LogoMark } from "@/components/shared/logo-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserForPasswordChange } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Set your password · Karta Lead Tracker" };

// Members land here after signing in with a temporary password from an admin;
// requireUser() sends them back here from every other page until they finish.
export default function SetPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <Suspense fallback={<SetPasswordSkeleton />}>
          <SetPasswordContent />
        </Suspense>
      </Card>
    </main>
  );
}

async function SetPasswordContent() {
  const { user, mustChangePassword } = await requireUserForPasswordChange();
  return (
    <>
      <CardHeader>
        <LogoMark className="mb-3 h-10 text-logo" />
        <CardTitle className="text-xl">{mustChangePassword ? `Welcome, ${user.name}` : "Set a new password"}</CardTitle>
        <CardDescription>
          {mustChangePassword
            ? "You signed in with a temporary password. Choose your own to continue."
            : "Your password is already set. You can change it any time in Settings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mustChangePassword ? (
          <SetPasswordForm />
        ) : (
          <Link href="/settings" className="text-sm font-medium underline underline-offset-4">
            Go to Settings
          </Link>
        )}
      </CardContent>
    </>
  );
}

function SetPasswordSkeleton() {
  return (
    <CardContent className="flex flex-col gap-4">
      <Skeleton className="h-10 w-10" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </CardContent>
  );
}
