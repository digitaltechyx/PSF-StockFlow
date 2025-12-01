"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
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
  Package,
  X,
  UserCheck,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile, UploadedPDF } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { hasFeature, hasRole } from "@/lib/permissions";

export function AdminSidebar() {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();

  // Get counts for badges
  const { data: users } = useCollection<UserProfile>("users");
  const { data: allUploadedPDFs } = useCollection<UploadedPDF>("uploadedPDFs");
  
  const activeUsersCount = users.filter(u => u.status === "active").length;
  const pendingUsersCount = users.filter(u => u.status === "pending").length;

  // Track current date to update when date changes
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // Update current date every minute to catch date changes
  useEffect(() => {
    const updateDate = () => {
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setCurrentDate(todayString);
    };

    // Update immediately
    updateDate();

    // Update every minute to catch date changes
    const interval = setInterval(updateDate, 60000);

    return () => clearInterval(interval);
  }, []);

  // Filter labels by current date (new labels)
  const newLabelsCount = useMemo(() => {
    return allUploadedPDFs.filter((pdf) => {
      // First try to use the date field if available
      if (pdf.date) {
        return pdf.date === currentDate;
      }
      
      // Otherwise, parse uploadedAt
      if (!pdf.uploadedAt) return false;
      
      let pdfDate: Date;
      if (typeof pdf.uploadedAt === 'string') {
        pdfDate = new Date(pdf.uploadedAt);
      } else if (pdf.uploadedAt.seconds) {
        pdfDate = new Date(pdf.uploadedAt.seconds * 1000);
      } else {
        return false;
      }
      
      const pdfDateString = `${pdfDate.getFullYear()}-${String(pdfDate.getMonth() + 1).padStart(2, '0')}-${String(pdfDate.getDate()).padStart(2, '0')}`;
      return pdfDateString === currentDate;
    }).length;
  }, [allUploadedPDFs, currentDate]);

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
      title: "Labels",
      url: "/admin/dashboard/labels",
      icon: Package,
      color: "text-pink-600",
      badge: newLabelsCount > 0 ? newLabelsCount : null,
      requiredFeature: "manage_labels" as const,
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

