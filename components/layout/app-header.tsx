"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { useUser } from "@/components/auth/user-provider";
import { CommandMenu } from "@/components/layout/command-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { canCreateLead } from "@/lib/auth/permissions";
import { getBreadcrumbs } from "@/lib/navigation";

/** Sticky top bar: sidebar toggle, breadcrumbs, search, "Add lead" and theme toggle. */
export function AppHeader() {
  const user = useUser();
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname, user.role);

  return (
    <header className="sticky top-0 z-20 print:hidden flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-center" />

      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <Fragment key={crumb.href}>
                {i > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
                <BreadcrumbItem className={isLast ? "min-w-0" : "hidden sm:inline-flex"}>
                  {isLast ? (
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        <CommandMenu />
        {canCreateLead(user) && (
          <Button asChild size="sm">
            <Link href="/leads/new" aria-label="Add lead">
              <PlusIcon />
              <span className="hidden sm:inline">Add lead</span>
            </Link>
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
