import { Skeleton } from "@/components/ui/skeleton";

/** Generic placeholder while a page's request-time content streams in. */
export function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
