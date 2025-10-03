"use client";

import type { UserProfile, InventoryItem } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddInventoryForm } from "./add-inventory-form";
import { ShipInventoryForm } from "./ship-inventory-form";
import { useCollection } from "@/hooks/use-collection";
import { Skeleton } from "../ui/skeleton";

export function InventoryManager({ user }: { user: UserProfile }) {
  const { data: inventory, loading: inventoryLoading } = useCollection<InventoryItem>(`users/${user.uid}/inventory`);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-headline">Manage Inventory for {user.name}</h2>
        <p className="text-muted-foreground">{user.email}</p>
      </div>

      <Tabs defaultValue="add">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="add">Add Inventory</TabsTrigger>
          <TabsTrigger value="ship">Shipped Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="add">
          <AddInventoryForm userId={user.uid} />
        </TabsContent>
        <TabsContent value="ship">
          {inventoryLoading ? (
            <div className="space-y-4 pt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-1/3" />
            </div>
          ) : (
            <ShipInventoryForm userId={user.uid} inventory={inventory} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
