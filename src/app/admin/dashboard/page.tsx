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
import { CreateUserForm } from "@/components/admin/create-user-form";
import { AddInventoryForm } from "@/components/admin/add-inventory-form";
import { ShipInventoryForm } from "@/components/admin/ship-inventory-form";
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage {user.name}'s Inventory</DialogTitle>
          <DialogDescription>
            Add inventory items and track shipments for {user.email}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="add" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add">Add Inventory</TabsTrigger>
            <TabsTrigger value="ship">Ship Inventory</TabsTrigger>
          </TabsList>
          
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

        {/* Current Inventory Summary */}
        <div className="mt-6 space-y-4">
          <h4 className="text-lg font-semibold">Current Inventory</h4>
          {inventoryLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : inventory.length > 0 ? (
            <div className="grid gap-2">
              {inventory.map((item) => (
                <div key={`inventory-${item.id}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium">{item.productName}</span>
                    <span className="text-muted-foreground ml-2">({item.quantity} units)</span>
                  </div>
                  <Badge variant={item.status === "In Stock" ? "default" : "destructive"}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No inventory items found</p>
          )}
        </div>
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

  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => user.uid !== adminUser?.uid) // Exclude admin from the list
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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold font-headline">User Management</h2>
          <p className="text-muted-foreground">Manage users and their inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Create User</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
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
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-8 w-48 sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>


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

      {/* User Management Modal */}
      {selectedUser && (
        <UserManagementModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
