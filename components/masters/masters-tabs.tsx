"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MASTER_TABS, type MasterTab } from "@/lib/masters";

/** One tab per master; the open tab lives in the URL (?tab=) so it survives a refresh and can be linked. */
export function MastersTabs({ initial, panels }: { initial: MasterTab; panels: Record<MasterTab, ReactNode> }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs
      defaultValue={initial}
      onValueChange={(tab) => router.replace(tab === "team" ? pathname : `${pathname}?tab=${tab}`, { scroll: false })}
    >
      {/* Scrolls sideways on phones instead of wrapping. */}
      <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:px-0">
        <TabsList>
          {MASTER_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {MASTER_TABS.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-2">
          {panels[t.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
