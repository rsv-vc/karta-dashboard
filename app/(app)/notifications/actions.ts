"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/** Marks everything in the viewer's notification feed as read (up to now). */
export async function markNotificationsRead(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ notifications_seen_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/", "layout");
  return { ok: true };
}
