"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { InventoryItem, ShippedItem } from "@/types";
import { InventoryTable } from "@/components/dashboard/inventory-table";
import { ShippedTable } from "@/components/dashboard/shipped-table";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { userProfile } = useAuth();
  
  const { 
    data: inventoryData, 
    loading: inventoryLoading 
  } = useCollection<InventoryItem>(
    userProfile ? `users/${userProfile.uid}/inventory` : ""
  );

  const { 
    data: shippedData, 
    loading: shippedLoading 
  } = useCollection<ShippedItem>(
    userProfile ? `users/${userProfile.uid}/shipped` : ""
  );

  return (
    <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
      <div className="grid auto-rows-max items-start gap-4 md:gap-8">
        {inventoryLoading ? <Skeleton className="h-96 w-full" /> : <InventoryTable data={inventoryData} />}
      </div>
      <div className="grid auto-rows-max items-start gap-4 md:gap-8">
        {shippedLoading ? <Skeleton className="h-96 w-full" /> : <ShippedTable data={shippedData} inventory={inventoryData} />}
      </div>
    </div>
  );
}
