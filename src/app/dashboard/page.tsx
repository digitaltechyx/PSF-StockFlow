"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { InventoryItem, ShippedItem, RestockHistory } from "@/types";
import { InventoryTable } from "@/components/dashboard/inventory-table";
import { ShippedTable } from "@/components/dashboard/shipped-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const [showRestockHistory, setShowRestockHistory] = useState(false);
  const [restockDateFilter, setRestockDateFilter] = useState<string>("all");
  
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

  const { 
    data: restockHistory, 
    loading: restockHistoryLoading 
  } = useCollection<RestockHistory>(
    userProfile ? `users/${userProfile.uid}/restockHistory` : ""
  );

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date === 'string') return format(new Date(date), "MMM dd, yyyy");
    return format(new Date(date.seconds * 1000), "MMM dd, yyyy");
  };

  // Helper function for date filtering
  const matchesDateFilter = (date: any, filter: string) => {
    if (filter === "all") return true;
    
    let itemDate: Date;
    if (typeof date === 'string') {
      itemDate = new Date(date);
    } else if (date && typeof date === 'object' && date.seconds) {
      itemDate = new Date(date.seconds * 1000);
    } else {
      return false;
    }
    
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (filter) {
      case "today":
        return daysDiff === 0;
      case "week":
        return daysDiff <= 7;
      case "month":
        return daysDiff <= 30;
      case "year":
        return daysDiff <= 365;
      default:
        return true;
    }
  };

  // Filtered restock history data
  const filteredRestockHistory = restockHistory.filter((item) => {
    return matchesDateFilter(item.restockedAt, restockDateFilter);
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toggle Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRestockHistory(!showRestockHistory)}
          className="flex items-center gap-2"
        >
          <History className="h-4 w-4" />
          {showRestockHistory ? "Hide" : "Show"} Restock History
        </Button>
      </div>

      {/* Restock History Section */}
      {showRestockHistory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Restock History ({filteredRestockHistory.length})</CardTitle>
                <CardDescription>View when your products were restocked by admins</CardDescription>
              </div>
              <div className="sm:w-48">
                <Select value={restockDateFilter} onValueChange={setRestockDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {restockHistoryLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredRestockHistory.length > 0 ? (
              <div className="space-y-3">
                {filteredRestockHistory
                  .sort((a, b) => {
                    const dateA = typeof a.restockedAt === 'string' ? new Date(a.restockedAt) : new Date(a.restockedAt.seconds * 1000);
                    const dateB = typeof b.restockedAt === 'string' ? new Date(b.restockedAt) : new Date(b.restockedAt.seconds * 1000);
                    return dateB.getTime() - dateA.getTime(); // Sort by newest first
                  })
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.productName}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Previous: {item.previousQuantity}</span>
                          <span className="text-green-600 font-medium">+{item.restockedQuantity}</span>
                          <span>New Total: {item.newQuantity}</span>
                          <span>Restocked by: {item.restockedBy}</span>
                          <span>Date: {formatDate(item.restockedAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No restock history</h3>
                <p className="text-muted-foreground">
                  {restockHistory.length === 0 ? "No products have been restocked yet." : "No restocks match your date filter."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid gap-2 sm:gap-4 md:gap-8 lg:grid-cols-2">
        <div className="grid auto-rows-max items-start gap-2 sm:gap-4 md:gap-8">
          {inventoryLoading ? <Skeleton className="h-64 sm:h-96 w-full" /> : <InventoryTable data={inventoryData} />}
        </div>
        <div className="grid auto-rows-max items-start gap-2 sm:gap-4 md:gap-8">
          {shippedLoading ? <Skeleton className="h-64 sm:h-96 w-full" /> : <ShippedTable data={shippedData} inventory={inventoryData} />}
        </div>
      </div>
    </div>
  );
}
