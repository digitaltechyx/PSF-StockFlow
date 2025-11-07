"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  History,
  Trash2,
  Edit,
  RotateCcw,
  FileText,
  Package,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { Invoice, UploadedPDF } from "@/types";
import { cn } from "@/lib/utils";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { userProfile, user } = useAuth();

  // Get counts for badges
  const { data: invoices } = useCollection<Invoice>(
    userProfile ? `users/${userProfile.uid}/invoices` : ""
  );
  const { data: allUploadedPDFs } = useCollection<UploadedPDF>("uploadedPDFs");
  const uploadedPDFs = userProfile?.role === "admin" 
    ? allUploadedPDFs 
    : allUploadedPDFs.filter((pdf) => pdf.uploadedBy === user?.uid);

  const pendingInvoicesCount = invoices.filter(inv => inv.status === 'pending').length;
  const labelsCount = uploadedPDFs.length;

  const menuItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      color: "text-blue-600",
    },
    {
      title: "Upload Labels",
      url: "/dashboard/labels",
      icon: Package,
      color: "text-indigo-600",
      badge: null,
    },
    {
      title: "Restock Summary",
      url: "/dashboard/restock-history",
      icon: History,
      color: "text-green-600",
    },
    {
      title: "Deleted Logs",
      url: "/dashboard/delete-logs",
      icon: Trash2,
      color: "text-red-600",
    },
    {
      title: "Modification Logs",
      url: "/dashboard/edit-logs",
      icon: Edit,
      color: "text-blue-600",
    },
    {
      title: "Disposed Inventory",
      url: "/dashboard/recycle-bin",
      icon: RotateCcw,
      color: "text-orange-600",
      badge: null,
    },
    {
      title: "Invoices",
      url: "/dashboard/invoices",
      icon: FileText,
      color: "text-purple-600",
      badge: pendingInvoicesCount > 0 ? pendingInvoicesCount : null,
    },
  ];

  return (
    <Sidebar className="border-r border-border/40 bg-gradient-to-b from-background to-muted/20">
      <SidebarHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight">PSF StockFlow</span>
            <span className="text-xs text-muted-foreground">Inventory Management</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.url;
                
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
