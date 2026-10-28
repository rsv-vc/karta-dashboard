"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { switchUserDev } from "@/app/(auth)/actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SessionUser } from "@/types/user";

type SwitchableUser = Pick<SessionUser, "id" | "name" | "role">;

/** Floating "view as" picker. The parent renders it only in development. */
export function DevUserSwitcher({ currentUserId, users }: { currentUserId: string; users: SwitchableUser[] }) {
  const [pending, startTransition] = useTransition();

  function handleChange(userId: string) {
    const target = users.find((u) => u.id === userId);
    startTransition(async () => {
      const result = await switchUserDev(userId);
      // On success the action redirects, so only errors come back here.
      if (result?.error) toast.error(result.error);
    });
    if (target) toast.success(`Viewing as ${target.name}`);
  }

  return (
    <div className="fixed right-16 bottom-4 z-50 flex items-center gap-2 rounded-lg border bg-background/95 p-2 text-xs shadow-lg backdrop-blur">
      <span className="font-medium text-muted-foreground">Dev · viewing as</span>
      <Select value={currentUserId} onValueChange={handleChange} disabled={pending}>
        <SelectTrigger size="sm" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name} {u.role === "admin" ? "(admin)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
