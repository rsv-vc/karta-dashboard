"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/components/auth/user-provider";
import { NavUser } from "@/components/layout/nav-user";
import { LogoMark } from "@/components/shared/logo-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { findNavItem, getNavLabel, getNavSections } from "@/lib/navigation";

/** Role-aware sidebar. Collapses to icons on desktop and becomes a sheet on mobile. */
export function AppSidebar({ overdueCount }: { overdueCount: number }) {
  const user = useUser();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const activeKey = findNavItem(pathname)?.key;

  // On mobile the sidebar is a sheet; close it once the user picks a page.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard" onClick={closeOnMobile}>
                <div className="flex aspect-square size-8 items-center justify-center text-logo">
                  <LogoMark className="h-7" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Karta</span>
                  <span className="truncate text-xs text-muted-foreground">Lead Tracker</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {getNavSections(user.role).map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => {
                const label = getNavLabel(item, user.role);
                const showBadge = item.badge === "overdueFollowUps" && overdueCount > 0;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton asChild isActive={activeKey === item.key} tooltip={label}>
                      <Link href={item.href} onClick={closeOnMobile}>
                        <item.icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {showBadge && (
                      <SidebarMenuBadge
                        className="text-red-600 dark:text-red-400"
                        aria-label={`${overdueCount} overdue follow-ups`}
                      >
                        {overdueCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
