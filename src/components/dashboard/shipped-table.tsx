"use client";

import type { InventoryItem, ShippedItem } from "@/types";
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
import { format } from "date-fns";

function formatDate(date: ShippedItem["date"]) {
    if (typeof date === 'string') {
      return format(new Date(date), "PPP");
    }
    if (date && typeof date === 'object' && 'seconds' in date) {
      return format(new Date(date.seconds * 1000), "PPP");
    }
    return "N/A";
  }

export function ShippedTable({ data, inventory }: { data: ShippedItem[], inventory: InventoryItem[] }) {

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 sm:pb-6">
        <CardTitle className="text-base sm:text-lg lg:text-xl">Order Shipped</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Details of products that have been shipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm">Product</TableHead>
                <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Date</TableHead>
                <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Shipped</TableHead>
                <TableHead className="text-xs sm:text-sm hidden md:table-cell">Pack</TableHead>
                <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length > 0 ? (
                data.map((item) => (
                  <TableRow key={item.id} className="text-xs sm:text-sm">
                    <TableCell className="font-medium max-w-32 sm:max-w-none truncate">
                      <div className="flex flex-col sm:block">
                        <span className="font-medium">{item.productName}</span>
                        <div className="sm:hidden mt-1 space-y-0.5 text-xs text-gray-500">
                          <span>{formatDate(item.date)}</span>
                          <br />
                          <span>Shipped: {item.shippedQty} units</span>
                          <br />
                          <span>Pack: {item.packOf}</span>
                          {item.remarks && (
                            <>
                              <br />
                              <span>Remarks: {item.remarks}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs">{formatDate(item.date)}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{item.shippedQty}</TableCell>
                    <TableCell className="hidden md:table-cell">{item.packOf}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="truncate max-w-20 block">{item.remarks || "-"}</span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="text-xs sm:text-sm text-gray-500">
                      No shipped orders found.
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
