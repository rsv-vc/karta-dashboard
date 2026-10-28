import { ArrowRightLeftIcon, CalendarIcon, MailIcon, PhoneIcon, StickyNoteIcon, type LucideIcon } from "lucide-react";
import type { NameOf } from "@/lib/team";
import { cn, formatDateTime } from "@/lib/utils";
import type { ActivityEntry, ActivityType } from "@/types/lead";

const TYPE_STYLE: Record<ActivityType, { icon: LucideIcon; label: string; className: string }> = {
  call: { icon: PhoneIcon, label: "Call", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  email: { icon: MailIcon, label: "Email", className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  meeting: { icon: CalendarIcon, label: "Meeting", className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  note: { icon: StickyNoteIcon, label: "Note", className: "bg-muted text-muted-foreground" },
  stage_change: {
    icon: ArrowRightLeftIcon,
    label: "Stage change",
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
};

/** Newest-first activity feed with a type icon, who did it and when. */
export function ActivityTimeline({ activities, nameOf }: { activities: ActivityEntry[]; nameOf: NameOf }) {
  // Stable ascending sort then reverse, so same-minute entries show the latest-added first.
  const items = [...activities].sort((a, b) => a.date.localeCompare(b.date)).reverse();
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;

  return (
    <ol className="relative flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-border">
      {items.map((a) => {
        const style = TYPE_STYLE[a.type];
        return (
          <li key={a.id} className="relative flex gap-3">
            <span
              className={cn("z-10 flex size-7 shrink-0 items-center justify-center rounded-full", style.className)}
              title={style.label}
            >
              <style.icon className="size-3.5" />
              <span className="sr-only">{style.label}</span>
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm break-words">{a.description}</p>
              <p className="text-xs text-muted-foreground">
                {nameOf(a.byUserId)} · {formatDateTime(a.date)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
