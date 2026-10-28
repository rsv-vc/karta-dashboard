import { Skeleton } from "@/components/ui/skeleton";

export type SkeletonLayout = "dashboard" | "table" | "detail" | "form" | "cards";

/**
 * Placeholder while a page's request-time content streams in, shaped like the
 * page it stands in for so nothing jumps when the content arrives.
 */
export function PageSkeleton({ layout = "cards" }: { layout?: SkeletonLayout }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {layout === "dashboard" && <DashboardBody />}
      {layout === "table" && <TableBody />}
      {layout === "detail" && <DetailBody />}
      {layout === "form" && <FormBody />}
      {layout === "cards" && <CardsBody />}
    </div>
  );
}

function DashboardBody() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </>
  );
}

function TableBody() {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-xl border p-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </>
  );
}

function DetailBody() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function FormBody() {
  return (
    <div className="flex max-w-3xl flex-col gap-4 rounded-xl border p-6">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ))}
    </div>
  );
}

function CardsBody() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-64" />
      ))}
    </div>
  );
}
