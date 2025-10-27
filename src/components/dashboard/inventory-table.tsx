"use client";

import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, X } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filtered inventory data
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 sm:pb-6">
        <CardTitle className="text-base sm:text-lg lg:text-xl">Your Inventory ({filteredData.length})</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          A list of products currently in your inventory.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 px-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="In Stock">In Stock</SelectItem>
                <SelectItem value="Out of Stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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
              {filteredData.length > 0 ? (
                paginatedData.map((item) => (
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
                      {data.length === 0 ? "No inventory items found." : "No items match your search criteria."}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {filteredData.length > itemsPerPage && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t px-6">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} items
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
