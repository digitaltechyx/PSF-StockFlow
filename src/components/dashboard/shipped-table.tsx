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
  
  const getTotalQuantity = (shippedItem: ShippedItem) => {
    return shippedItem.shippedQty + shippedItem.remainingQty;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Shipped</CardTitle>
        <CardDescription>
          Details of products that have been shipped.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Quantity (Shipped/Total)</TableHead>
              <TableHead>Pack Of</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productName}</TableCell>
                  <TableCell>{formatDate(item.date)}</TableCell>
                  <TableCell>{`${item.shippedQty} / ${getTotalQuantity(item)}`}</TableCell>
                  <TableCell>{item.packOf}</TableCell>
                  <TableCell>{item.remarks || "-"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No shipped orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
