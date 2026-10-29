"use client";

import { AlertTriangleIcon, BellIcon, CheckCheckIcon, PartyPopperIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { markNotificationsRead } from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AppNotification, NotificationFeed, NotificationTone } from "@/lib/notifications";
import { cn, formatDaysAgo } from "@/lib/utils";

const TONE: Record<NotificationTone, { icon: typeof BellIcon; className: string; label: string }> = {
  alert: { icon: AlertTriangleIcon, className: "bg-destructive/10 text-destructive", label: "Needs attention" },
  celebrate: { icon: PartyPopperIcon, className: "bg-primary/10 text-primary", label: "Win" },
  info: { icon: SparklesIcon, className: "bg-muted text-muted-foreground", label: "News" },
};

/** Header bell: overdue alerts first, then wins and news. Opening it marks the feed as read. */
export function NotificationBell({ feed }: { feed: NotificationFeed }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useOptimistic(feed.unread);
  const [, startTransition] = useTransition();
  const alerts = feed.items.filter((n) => n.tone === "alert");
  const news = feed.items.filter((n) => n.tone !== "alert");

  function markRead() {
    startTransition(async () => {
      setUnread(0);
      await markNotificationsRead();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Closing after a look counts as read.
        if (!next && unread > 0) markRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <BellIcon aria-hidden="true" />
          {/* The accessible name ("Notifications, 3 unread") is built from the visible count. */}
          <span className="sr-only">Notifications{unread > 0 ? ", " : ""}</span>
          {unread > 0 && (
            // red-700 keeps the white count legible in both themes.
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-700 px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
          {unread > 0 && <span className="sr-only"> unread</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="font-medium">Notifications</h2>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markRead}>
              <CheckCheckIcon />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
          {feed.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You are all caught up.</p>
          ) : (
            <>
              <Group title="Needs attention" items={alerts} onPick={() => setOpen(false)} />
              <Group title="Wins & news" items={news} onPick={() => setOpen(false)} />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Group({ title, items, onPick }: { title: string; items: AppNotification[]; onPick: () => void }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h3 className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">{title}</h3>
      <ul>
        {items.map((n) => {
          const tone = TONE[n.tone];
          const Icon = tone.icon;
          return (
            <li key={n.id}>
              <Link href={n.href} onClick={onPick} className="flex gap-3 px-4 py-2.5 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", tone.className)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">{tone.label}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">{n.detail}</span>
                </span>
                {n.tone !== "alert" && <span className="shrink-0 text-xs text-muted-foreground">{formatDaysAgo(n.at)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
