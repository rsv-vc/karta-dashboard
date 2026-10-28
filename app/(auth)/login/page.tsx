import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { LoginForm } from "@/components/auth/login-form";
import { LogoMark } from "@/components/shared/logo-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in · Karta Lead Tracker" };

/** Reads `next` from the URL; request data, so it renders inside Suspense. */
async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : null;
  return (
    <>
      <LoginForm next={nextPath} />
      <Separator />
      <DemoAccounts next={nextPath} />
    </>
  );
}

function LoginSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <LogoMark className="mb-3 h-10 text-logo" />
          <CardTitle className="text-xl">Karta Lead Tracker</CardTitle>
          <CardDescription>Sign in to manage your leads.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Suspense fallback={<LoginSkeleton />}>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
