"use client";

import React, { useState, useMemo } from "react";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Users, UserPlus, Shield } from "lucide-react";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { MemberManagement } from "@/components/admin/member-management";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUsersPage() {
  const { userProfile: adminUser } = useAuth();
  const { data: users, loading: usersLoading } = useCollection<UserProfile>("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);

  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => user.uid !== adminUser?.uid)
      .filter((user) => user.status !== "deleted")
      .filter((user) => {
        if (searchTerm === "") return true;
        const name = user.name?.toLowerCase() || "";
        const email = user.email?.toLowerCase() || "";
        const phone = user.phone?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        return name.includes(term) || email.includes(term) || phone.includes(term);
      });
  }, [users, adminUser, searchTerm]);

  const pendingUsersCount = users.filter((user) => 
    user.uid !== adminUser?.uid && user.status === "pending"
  ).length;

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Users className="h-6 w-6" />
                User Management
              </CardTitle>
              <CardDescription className="text-green-100 mt-2">
                Manage user accounts and approvals ({filteredUsers.length} users)
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shield className="h-7 w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 shadow-sm"
                />
              </div>
            </div>
            <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2 shadow-sm">
                  <UserPlus className="h-4 w-4" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the inventory management system.
                  </DialogDescription>
                </DialogHeader>
                <CreateUserForm 
                  onSuccess={() => setShowCreateUser(false)}
                  onCancel={() => setShowCreateUser(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {usersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <MemberManagement adminUser={adminUser} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}


