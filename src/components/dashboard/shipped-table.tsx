"use client";

import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, X } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Filtered shipped data
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (dateFilter !== "all") {
        const itemDate = new Date(item.date.seconds * 1000);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case "today":
            matchesDate = daysDiff === 0;
            break;
          case "week":
            matchesDate = daysDiff <= 7;
            break;
          case "month":
            matchesDate = daysDiff <= 30;
            break;
          case "year":
            matchesDate = daysDiff <= 365;
            break;
        }
      }
      
      return matchesSearch && matchesDate;
    });
  }, [data, searchTerm, dateFilter]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 sm:pb-6">
        <CardTitle className="text-base sm:text-lg lg:text-xl">Order Shipped ({filteredData.length})</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Details of products that have been shipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 px-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shipped orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <div className="sm:w-48">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
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
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
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
                      {data.length === 0 ? "No shipped orders found." : "No orders match your search criteria."}
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
