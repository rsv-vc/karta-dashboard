import type { ReactNode } from "react";

/** Centered, width-capped column used by every page inside the shell. */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">{children}</div>;
}
