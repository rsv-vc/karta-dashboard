import { Skeleton } from "@/components/ui/skeleton";

/** Generic placeholder while a page's request-time content streams in. */
export function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
