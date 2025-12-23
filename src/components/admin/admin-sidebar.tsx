"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  FileText,
  Shield,
  X,
  UserCheck,
  Briefcase,
  DollarSign,
  ArrowLeftRight,
  Bell,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { hasFeature, hasRole } from "@/lib/permissions";
import { collectionGroup, getCountFromServer, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function AdminSidebar() {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();

  // Get counts for badges
  const { data: users } = useCollection<UserProfile>("users");
  
  const activeUsersCount = users.filter(u => u.status === "active").length;
  const pendingUsersCount = users.filter(u => u.status === "pending").length;

  // Pending requests badge (Notifications)
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const countStatuses = async (collectionName: string, statuses: string[]) => {
          const counts = await Promise.all(
            statuses.map(async (status) => {
              const q = query(collectionGroup(db, collectionName), where("status", "==", status));
              const snap = await getCountFromServer(q);
              return snap.data().count || 0;
            })
          );
          return counts.reduce((a, b) => a + b, 0);
        };

        const [shipmentPending, inventoryPending, productReturnPending] = await Promise.all([
          // Shipment requests may use "pending" or "Pending"
          countStatuses("shipmentRequests", ["pending", "Pending"]),
          // Inventory requests may use "pending" or "Pending" (older data)
          countStatuses("inventoryRequests", ["pending", "Pending"]),
          // Product returns: pending-ish statuses (support mixed casing / legacy formatting)
          countStatuses("productReturns", [
            "pending",
            "Pending",
            "approved",
            "Approved",
            "in_progress",
            "In Progress",
            "in progress",
          ]),
        ]);

        if (!cancelled) setPendingRequestsCount(shipmentPending + inventoryPending + productReturnPending);
      } catch {
        if (!cancelled) setPendingRequestsCount(0);
      }
    };

    // Prefer realtime badge updates (so badge increases immediately when new request arrives)
    const shipmentQ = query(
      collectionGroup(db, "shipmentRequests"),
      where("status", "in", ["pending", "Pending"])
    );
    const inventoryQ = query(
      collectionGroup(db, "inventoryRequests"),
      where("status", "in", ["pending", "Pending"])
    );
    const returnsQ = query(
      collectionGroup(db, "productReturns"),
      where("status", "in", ["pending", "Pending", "approved", "Approved", "in_progress", "In Progress", "in progress"])
    );

    let shipmentCount = 0;
    let inventoryCount = 0;
    let returnsCount = 0;
    const push = () => {
      if (!cancelled) setPendingRequestsCount(shipmentCount + inventoryCount + returnsCount);
    };

    let unsub1: (() => void) | null = null;
    let unsub2: (() => void) | null = null;
    let unsub3: (() => void) | null = null;

    try {
      unsub1 = onSnapshot(shipmentQ, (snap) => {
        shipmentCount = snap.size;
        push();
      });
      unsub2 = onSnapshot(inventoryQ, (snap) => {
        inventoryCount = snap.size;
        push();
      });
      unsub3 = onSnapshot(returnsQ, (snap) => {
        returnsCount = snap.size;
        push();
      });
    } catch {
      // Fallback to polling if realtime listeners fail (permissions / indexing)
      run();
    }

    // Also refresh counts when tab becomes visible
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);

    const interval = setInterval(run, 60000);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(interval);
      unsub1?.();
      unsub2?.();
      unsub3?.();
    };
  }, []);

  // Filter menu items based on user's features
  // Admin has all features automatically, sub_admin needs explicit grants
  const allMenuItems = [
    {
      title: "Dashboard",
      url: "/admin/dashboard",
      icon: LayoutDashboard,
      color: "text-blue-600",
      requiredFeature: "admin_dashboard" as const,
    },
    {
      title: "Notification",
      url: "/admin/dashboard/notifications",
      icon: Bell,
      color: "text-purple-600",
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
      requiredFeature: "admin_dashboard" as const,
    },
    {
      title: "Users",
      url: "/admin/dashboard/users",
      icon: Users,
      color: "text-green-600",
      badge: activeUsersCount > 0 ? activeUsersCount : null,
      requiredFeature: "manage_users" as const,
    },
    {
      title: "Invoices",
      url: "/admin/dashboard/invoices",
      icon: FileText,
      color: "text-indigo-600",
      requiredFeature: "manage_invoices" as const,
    },
    {
      title: "Pricing",
      url: "/admin/dashboard/pricing",
      icon: DollarSign,
      color: "text-amber-600",
      requiredFeature: "admin_dashboard" as const,
    },
    {
      title: "Product Returns",
      url: "/admin/dashboard/product-returns",
      icon: ArrowLeftRight,
      color: "text-orange-600",
      requiredFeature: "admin_dashboard" as const,
    },
  ];

  // Filter menu items based on user's role and features
  const menuItems = allMenuItems.filter((item) => {
    // Admin always sees all items
    if (hasRole(userProfile, "admin")) {
      return true;
    }
    // Sub admin only sees items for which they have the required feature
    if (hasRole(userProfile, "sub_admin")) {
      return hasFeature(userProfile, item.requiredFeature);
    }
    return false;
  });

  // Check if user has other roles (client or commission agent) to show additional dashboard links
  const hasUserRole = hasRole(userProfile, "user");
  const hasAgentRole = hasRole(userProfile, "commission_agent");
  const hasOtherRoles = hasUserRole || hasAgentRole;

  return (
    <Sidebar className="border-r border-border/40 bg-gradient-to-b from-background to-muted/20">
      <SidebarHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-orange-600 shadow-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight">Admin Panel</span>
              <span className="text-xs text-muted-foreground">PSF StockFlow Management</span>
            </div>
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              onClick={() => setOpenMobile(false)}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close sidebar</span>
            </Button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {menuItems.length > 0 ? (
              <SidebarMenu className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.url || (item.url === "/admin/dashboard" && pathname === "/admin/dashboard");
                  
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={cn(
                          "group relative h-11 rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-sm border border-primary/20" 
                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Link href={item.url} className="flex items-center gap-3">
                          <Icon className={cn(
                            "h-5 w-5 transition-transform group-hover:scale-110",
                            isActive ? item.color : "text-muted-foreground"
                          )} />
                          <span className={cn(
                            "font-medium transition-colors",
                            isActive && "font-semibold"
                          )}>
                            {item.title}
                          </span>
                          {item.badge !== null && item.badge !== undefined && (
                            <SidebarMenuBadge className={cn(
                              "ml-auto bg-primary text-primary-foreground shadow-sm",
                              isActive && "bg-primary/90"
                            )}>
                              {item.badge}
                            </SidebarMenuBadge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            ) : hasRole(userProfile, "sub_admin") ? (
              <div className="px-3 py-4 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  No Admin Features Granted
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  You have sub_admin role but no admin features have been granted. Please contact an administrator to grant you access to admin features.
                </p>
              </div>
            ) : null}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Other Dashboards Section - Show if user has multiple roles */}
        {hasOtherRoles && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Other Dashboards
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {hasUserRole && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Client Dashboard"
                      className="group relative h-11 rounded-lg transition-all duration-200 hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    >
                      <Link href="/dashboard" className="flex items-center gap-3">
                        <Briefcase className="h-5 w-5 transition-transform group-hover:scale-110 text-muted-foreground" />
                        <span className="font-medium transition-colors">
                          Client Dashboard
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {hasAgentRole && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Affiliate Dashboard"
                      className="group relative h-11 rounded-lg transition-all duration-200 hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    >
                      <Link href="/dashboard/agent" className="flex items-center gap-3">
                        <UserCheck className="h-5 w-5 transition-transform group-hover:scale-110 text-muted-foreground" />
                        <span className="font-medium transition-colors">
                          Affiliate Dashboard
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

