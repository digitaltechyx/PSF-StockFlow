"use client";

import React, { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { AdminInventoryManagement } from "@/components/admin/admin-inventory-management";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile, InventoryItem, ShippedItem } from "@/types";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

function InventoryContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  
  const { data: users, loading: usersLoading } = useCollection<UserProfile>("users");
  const selectedUser = users.find(u => u.uid === userId) || users[0];
  
  const { data: inventory, loading: inventoryLoading } = useCollection<InventoryItem>(
    selectedUser ? `users/${selectedUser.uid}/inventory` : ""
  );
  const { data: shipped, loading: shippedLoading } = useCollection<ShippedItem>(
    selectedUser ? `users/${selectedUser.uid}/shipped` : ""
  );

  return (
    <Card className="border-2 shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <Package className="h-6 w-6" />
              Inventory Management
            </CardTitle>
            <CardDescription className="text-purple-100 mt-2">
              {selectedUser ? `Managing inventory for ${selectedUser.name}` : "Select a user to manage their inventory"}
            </CardDescription>
          </div>
          <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Package className="h-7 w-7 text-white" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {usersLoading || !selectedUser ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <AdminInventoryManagement 
            selectedUser={selectedUser}
            inventory={inventory}
            shipped={shipped}
            loading={inventoryLoading}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminInventoryPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={
        <Card className="border-2 shadow-xl">
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full rounded-xl" />
          </CardContent>
        </Card>
      }>
        <InventoryContent />
      </Suspense>
    </div>
  );
}

