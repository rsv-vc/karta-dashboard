import { Badge } from "@/components/ui/badge";
import { NAV_ITEMS, type NavKey } from "@/lib/navigation";

/**
 * Placeholder for a page a later phase fills in. Icon and phase come from the nav
 * config; `phase` overrides it where it differs by role. The page header already
 * shows the nav description, so the default text here is generic.
 */
export function ComingSoon({
  navKey,
  features,
  phase,
  description,
}: {
  navKey: NavKey;
  features: string[];
  phase?: number;
  description?: string;
}) {
  const item = NAV_ITEMS[navKey];
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center sm:p-12">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <item.icon className="size-6 text-muted-foreground" />
      </div>
      <Badge variant="secondary">Coming in Phase {phase ?? item.phase}</Badge>
      <p className="max-w-md text-sm text-muted-foreground">{description ?? "This page is being built. Here is what it will include:"}</p>
      <ul className="flex flex-col gap-1 text-left text-sm text-muted-foreground">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span aria-hidden>•</span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
