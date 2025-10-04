"use client";

import type { InventoryItem } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

function formatDate(date: InventoryItem["dateAdded"]) {
  if (typeof date === 'string') {
    return format(new Date(date), "PPP");
  }
  if (date && typeof date === 'object' && 'seconds' in date) {
    return format(new Date(date.seconds * 1000), "PPP");
  }
  return "N/A";
}


export function InventoryTable({ data }: { data: InventoryItem[] }) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2 sm:pb-6">
        <CardTitle className="text-base sm:text-lg lg:text-xl">Your Inventory</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          A list of products currently in your inventory.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm">Product</TableHead>
                <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Quantity</TableHead>
                <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Date Added</TableHead>
                <TableHead className="text-xs sm:text-sm">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length > 0 ? (
                data.map((item) => (
               <TableRow key={item.id} className="text-xs sm:text-sm">
                    <TableCell className="font-medium max-w-32 sm:max-w-none truncate">
                      <div className="flex flex-col sm:block">
                        <span className="font-medium">{item.productName}</span>
                        <div className="sm:hidden mt-1 space-y-0.5">
                          <span className="text-gray-500 text-xs">Qty: {item.quantity}</span>
                          <br />
                          <span className="text-gray-500 text-xs">Added: {formatDate(item.dateAdded)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{item.quantity}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatDate(item.dateAdded)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={item.status === "In Stock" ? "secondary" : "destructive"}
                        className="text-xs px-2 py-1"
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="text-xs sm:text-sm text-gray-500">
                      No inventory items found.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
