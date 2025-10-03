"use client";

import type { UserProfile } from "@/types";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
} from "../ui/sidebar";
import { Search, User } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";

interface UserListProps {
  users: UserProfile[];
  selectedUser: UserProfile | null;
  onSelectUser: (user: UserProfile) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  loading: boolean;
}

export function UserList({
  users,
  selectedUser,
  onSelectUser,
  searchTerm,
  onSearchChange,
  loading,
}: UserListProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Users</SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[calc(100vh-14rem)] mt-2">
          <SidebarMenu>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SidebarMenuItem key={`skeleton-${i}`}>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              ))
            ) : users.length > 0 ? (
              users.map((user) => (
                <SidebarMenuItem key={user.uid}>
                  <SidebarMenuButton
                    onClick={() => onSelectUser(user)}
                    isActive={selectedUser?.uid === user.uid}
                    className="w-full justify-start"
                  >
                    <User className="h-4 w-4" />
                    <span>{user.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            ) : (
              <SidebarMenuItem key="no-users">
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No users found.
                </div>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </ScrollArea>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
