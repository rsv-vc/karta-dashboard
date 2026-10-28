import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A single headline number: sentence-case label, a large value in proportional
 * figures, and an optional supporting line. Optionally the whole tile links.
 */
export function StatTile({
  label,
  value,
  detail,
  href,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  tone?: "default" | "alert";
  icon?: ReactNode;
}) {
  const body = (
    <Card className={cn("h-full", href && "transition-colors hover:bg-muted/40")}>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            "flex items-center gap-2 text-2xl font-semibold tracking-tight",
            tone === "alert" && "text-red-700 dark:text-red-400",
          )}
        >
          {icon}
          {value}
        </span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
