import type { Metadata } from "next";
import Link from "next/link";
import { ShieldXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access · Karta Lead Tracker" };

export default function NoAccessPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldXIcon className="size-10 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-muted-foreground">
        This area is limited to admins. Ask your Chief Growth Officer if you think you need access.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
