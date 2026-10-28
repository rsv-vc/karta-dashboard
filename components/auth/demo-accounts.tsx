import { loginAsDemo } from "@/app/(auth)/actions";
import { RoleBadge } from "@/components/auth/role-badge";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Button } from "@/components/ui/button";
import { mockUsers } from "@/data/mock-users";
import { isDemoMode } from "@/lib/supabase/env";

/** One-click sign-in for each seeded demo account. Rendered only in demo mode. */
export function DemoAccounts({ next }: { next: string | null }) {
  if (!isDemoMode()) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Demo accounts</h2>
        <p className="text-xs text-muted-foreground">One click, no password needed</p>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border">
        {mockUsers
          .filter((u) => u.status === "active")
          .map((user) => (
            <li key={user.id} className="flex items-center gap-3 p-2.5">
              <UserAvatar name={user.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{user.name}</span>
                  <RoleBadge role={user.role} />
                </div>
                <div className="truncate text-xs text-muted-foreground">{user.title}</div>
              </div>
              <form action={loginAsDemo.bind(null, user.id, next)}>
                <Button type="submit" size="sm" variant="outline" aria-label={`Sign in as ${user.name}`}>
                  Sign in
                </Button>
              </form>
            </li>
          ))}
      </ul>
    </div>
  );
}
