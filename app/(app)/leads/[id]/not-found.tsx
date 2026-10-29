import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// notFound() from the lead page: the id does not exist (or was deleted).
export default function LeadNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchXIcon className="size-6" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold">Lead not found</h1>
      <p className="text-sm text-muted-foreground">It may have been deleted, or the link is mistyped.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/leads">All leads</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/leads">All leads</Link>
        </Button>
      </div>
    </div>
  );
}
