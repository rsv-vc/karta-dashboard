"use client";

import { NotebookTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** The account's notes behind a small icon, for quick context from the lead list. Click or tap to open. */
export function NotesPopover({ companyName, notes }: { companyName: string; notes: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Notes for ${companyName}`}>
          <NotebookTextIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
        <p className="text-sm break-words whitespace-pre-line">{notes}</p>
      </PopoverContent>
    </Popover>
  );
}
