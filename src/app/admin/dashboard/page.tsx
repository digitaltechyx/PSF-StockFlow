"use client";

import React, { useState, useMemo } from "react";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile, InventoryItem, ShippedItem } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Users, Eye, UserPlus } from "lucide-react";
import { MemberManagement } from "@/components/admin/member-management";
import { AdminInventoryManagement } from "@/components/admin/admin-inventory-management";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { AddInventoryForm } from "@/components/admin/add-inventory-form";
import { ShipInventoryForm } from "@/components/admin/ship-inventory-form";
import { InvoiceManagement } from "@/components/admin/invoice-management";
import { Skeleton } from "@/components/ui/skeleton";

// User Card Component
function UserCard({ 
  user, 
  onSelectUser, 
  selectedUser 
}: { 
  user: UserProfile; 
  onSelectUser: (user: UserProfile) => void;
  selectedUser: UserProfile | null;
}) {
  return (
    <Card className={`cursor-pointer transition-all hover:shadow-md ${
      selectedUser?.uid === user.uid ? 'ring-2 ring-primary' : ''
    }`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{user.name || 'Unnamed User'}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
          <Badge variant="secondary">{user.role}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Phone: {user.phone || 'Not provided'}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              onClick={() => onSelectUser(user)}
              className="flex-1"
            >
              <Eye className="h-4 w-4 mr-2" />
              Manage
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// User Management Modal Component
function UserManagementModal({ 
  user, 
  onClose 
}: { 
  user: UserProfile; 
  onClose: () => void;
}) {
  const { data: inventory, loading: inventoryLoading } = useCollection<InventoryItem>(`users/${user.uid}/inventory`);
  const { data: shipped, loading: shippedLoading } = useCollection<ShippedItem>(`users/${user.uid}/shipped`);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto overflow-x-hidden px-2 sm:px-0">
        <DialogHeader>
          <DialogTitle className="text-sm sm:text-base truncate">Manage {user.name}'s Inventory</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm break-words">
            Add inventory items, track shipments, and manage products for {user.email}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="manage" className="w-full">
          <TabsList className="grid grid-cols-3 w-full gap-1 sm:gap-0">
            <TabsTrigger value="manage" className="px-2 py-2 text-xs sm:text-sm">Manage Products</TabsTrigger>
            <TabsTrigger value="add" className="px-2 py-2 text-xs sm:text-sm">Add Inventory</TabsTrigger>
            <TabsTrigger value="ship" className="px-2 py-2 text-xs sm:text-sm">Ship Inventory</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manage" className="space-y-4">
            <AdminInventoryManagement 
              selectedUser={user}
              inventory={inventory}
              shipped={shipped}
              loading={inventoryLoading}
            />
          </TabsContent>
          
          <TabsContent value="add" className="space-y-4">
            <AddInventoryForm userId={user.uid} />
          </TabsContent>
          
          <TabsContent value="ship" className="space-y-4">
            {inventoryLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <ShipInventoryForm userId={user.uid} inventory={inventory} />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboardPage() {
  const { userProfile: adminUser } = useAuth();
  const { data: users, loading: usersLoading } = useCollection<UserProfile>("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [mobileSection, setMobileSection] = useState<"users" | "members" | "invoices">("users");

  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => user.uid !== adminUser?.uid) // Exclude admin from the list
      .filter((user) => user.status !== "deleted") // Exclude deleted users
      .filter((user) => {
        // Show approved users OR users without status (existing users)
        return user.status === "approved" || !user.status;
      })
      .filter((user) => {
        if (searchTerm === "") return true;
        const name = user.name?.toLowerCase() || "";
        const email = user.email?.toLowerCase() || "";
        const phone = user.phone?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        return name.includes(term) || email.includes(term) || phone.includes(term);
      });
  }, [users, adminUser, searchTerm]);

  const totalUsers = filteredUsers.length;
  
  // Calculate pending users count for badge
  const pendingUsersCount = users.filter((user) => 
    user.uid !== adminUser?.uid && user.status === "pending"
  ).length;

  return (
    <div className="space-y-6 pb-16 sm:pb-6">{/* pb-16 to clear bottom tab bar on mobile */}
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold font-headline">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage users, members, and inventory</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
          <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 w-full sm:w-auto">
                <UserPlus className="h-4 w-4" />
                <span className="">Create User</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-8 w-full sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Navigation (top buttons) */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <Button variant={mobileSection === "users" ? "default" : "outline"} size="sm" className="w-full" onClick={() => setMobileSection("users")}>Inventory</Button>
        <Button variant={mobileSection === "members" ? "default" : "outline"} size="sm" className="w-full" onClick={() => setMobileSection("members")}>Users</Button>
        <Button variant={mobileSection === "invoices" ? "default" : "outline"} size="sm" className="w-full" onClick={() => setMobileSection("invoices")}>Invoices</Button>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden sm:block">
        {/* Main Tabs */}
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="flex w-full overflow-x-auto no-scrollbar gap-2 sm:grid sm:grid-cols-3 sm:gap-0">
            <TabsTrigger value="users" className="whitespace-nowrap flex-1">
              <span className="sm:hidden">Inventory</span>
              <span className="hidden sm:inline">Inventory Management</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="relative whitespace-nowrap flex-1">
              <span className="sm:hidden">Users</span>
              <span className="hidden sm:inline">User Management</span>
              {pendingUsersCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {pendingUsersCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="whitespace-nowrap flex-1">
              <span className="sm:hidden">Invoices</span>
              <span className="hidden sm:inline">Invoice Management</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4 mt-6">
            {/* Users Grid */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Users ({totalUsers})</h3>
              
              {usersLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Card key={`skeleton-${i}`}>
                      <CardHeader>
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredUsers.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredUsers.map((user) => (
                    <UserCard 
                      key={`user-${user.uid}`} 
                      user={user} 
                      onSelectUser={setSelectedUser}
                      selectedUser={selectedUser}
                    />
                  ))}
                </div>
              ) : (
                <Card key="no-users-card">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No users found</h3>
                    <p className="text-muted-foreground text-center">
                      {searchTerm ? "Try adjusting your search terms" : "No users have registered yet"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-6">
            <MemberManagement adminUser={adminUser} />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4 mt-6">
            <InvoiceManagement users={users} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile Content (single-column) */}
      <div className="sm:hidden">
        {mobileSection === "users" && (
          <div className="space-y-4 mt-4">
            <h3 className="text-lg font-semibold">Users ({totalUsers})</h3>
            {usersLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Card key={`skeleton-m-${i}`}>
                    <CardHeader>
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredUsers.map((user) => (
                  <UserCard 
                    key={`user-m-${user.uid}`} 
                    user={user} 
                    onSelectUser={setSelectedUser}
                    selectedUser={selectedUser}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {mobileSection === "members" && (
          <div className="mt-4">
            <MemberManagement adminUser={adminUser} />
          </div>
        )}

        {mobileSection === "invoices" && (
          <div className="mt-4">
            <InvoiceManagement users={users} />
          </div>
        )}
      </div>

      {/* User Management Modal */}
      {selectedUser && (
        <UserManagementModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* Bottom Tab Bar (Mobile) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 border-t bg-background px-3 py-2 z-40">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={mobileSection === "users" ? "default" : "ghost"}
            className="w-full justify-center"
            size="sm"
            onClick={() => setMobileSection("users")}
          >
            Inventory
          </Button>
          <Button
            variant={mobileSection === "members" ? "default" : "ghost"}
            className="w-full justify-center"
            size="sm"
            onClick={() => setMobileSection("members")}
          >
            Users
          </Button>
          <Button
            variant={mobileSection === "invoices" ? "default" : "ghost"}
            className="w-full justify-center"
            size="sm"
            onClick={() => setMobileSection("invoices")}
          >
            Invoices
          </Button>
        </div>
      </div>
    </div>
  );
}