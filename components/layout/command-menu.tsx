"use client";

import { BuildingIcon, LoaderIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { searchLeads, type LeadSearchHit } from "@/app/(app)/leads/actions";
import { useUser } from "@/components/auth/user-provider";
import { StageBadge } from "@/components/shared/stage-badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { getNavLabel, getNavSections } from "@/lib/navigation";

/** Ctrl/Cmd+K: jump to a page or to any lead you can open. */
export function CommandMenu() {
  const user = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadSearchHit[]>([]);
  const [searching, startSearch] = useTransition();
  const pages = getNavSections(user.role).flatMap((s) => s.items);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced server search; the latest query wins.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let stale = false;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchLeads(q);
        if (!stale) setHits(result);
      });
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setHits([]);
    }
  }

  function go(href: string) {
    changeOpen(false);
    router.push(href);
  }

  const showLeads = query.trim().length >= 2;

  return (
    <>
      {/* The visible text is the accessible name (so "click Search" works for voice control). */}
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground sm:w-48 sm:justify-start"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <SearchIcon />
        <span className="sr-only sm:not-sr-only">Search…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] text-foreground sm:inline" aria-hidden="true">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={changeOpen}
        title="Search"
        description="Jump to a page, or find a lead by company, contact or id."
      >
        <Command>
          <CommandInput placeholder="Search pages and leads…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{searching ? "Searching…" : showLeads ? "No matching leads or pages." : "No matching pages."}</CommandEmpty>
            {showLeads && hits.length > 0 && (
              <CommandGroup heading="Leads">
                {hits.map((lead) => (
                  <CommandItem
                    key={lead.id}
                    value={`${lead.companyName} ${lead.pocName} ${lead.id}`}
                    onSelect={() => go(`/leads/${lead.id}`)}
                  >
                    <BuildingIcon />
                    <span className="min-w-0 flex-1 truncate">
                      {lead.companyName}
                      <span className="text-muted-foreground"> · {lead.pocName}</span>
                    </span>
                    <StageBadge stage={lead.stage} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Pages">
              {pages.map((item) => (
                <CommandItem key={item.key} value={getNavLabel(item, user.role)} onSelect={() => go(item.href)}>
                  <item.icon />
                  {getNavLabel(item, user.role)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {searching && (
            <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
              <LoaderIcon className="size-3 animate-spin" /> Searching leads…
              <CommandShortcut>Esc to close</CommandShortcut>
            </div>
          )}
        </Command>
      </CommandDialog>
    </>
  );
}
