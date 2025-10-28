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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Filter, X, Eye } from "lucide-react";
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedRemarks, setSelectedRemarks] = useState<string>("");
  const [isRemarksDialogOpen, setIsRemarksDialogOpen] = useState(false);
  const [selectedShipTo, setSelectedShipTo] = useState<string>("");
  const [isShipToDialogOpen, setIsShipToDialogOpen] = useState(false);

  const handleRemarksClick = (remarks: string) => {
    setSelectedRemarks(remarks);
    setIsRemarksDialogOpen(true);
  };

  const handleShipToClick = (shipTo: string) => {
    setSelectedShipTo(shipTo);
    setIsShipToDialogOpen(true);
  };

  // Filtered and sorted shipped data (most recent first)
  const filteredData = useMemo(() => {
    const filtered = data.filter((item) => {
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesDate = true;
      if (dateFilter !== "all") {
        const itemDate = typeof item.date === 'string' 
          ? new Date(item.date) 
          : new Date(item.date.seconds * 1000);
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

    // Sort by createdAt when available, otherwise by date (most recent first)
    return filtered.sort((a, b) => {
      const aCreated = a.createdAt
        ? (typeof a.createdAt === 'string' ? new Date(a.createdAt) : new Date(a.createdAt.seconds * 1000))
        : (typeof a.date === 'string' ? new Date(a.date) : new Date(a.date.seconds * 1000));
      const bCreated = b.createdAt
        ? (typeof b.createdAt === 'string' ? new Date(b.createdAt) : new Date(b.createdAt.seconds * 1000))
        : (typeof b.date === 'string' ? new Date(b.date) : new Date(b.date.seconds * 1000));
      return bCreated.getTime() - aCreated.getTime();
    });
  }, [data, searchTerm, dateFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter]);

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
            <Select value={dateFilter} onValueChange={(value) => {
              setDateFilter(value);
              setCurrentPage(1);
            }}>
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
                <TableHead className="text-xs sm:text-sm hidden md:table-cell">Ship To</TableHead>
                <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {filteredData.length > 0 ? (
                paginatedData.map((item) => (
                  <TableRow key={item.id} className="text-xs sm:text-sm">
                    <TableCell className="font-medium max-w-32 sm:max-w-none truncate">
                      <div className="flex flex-col sm:block">
                        <span className="font-medium">{item.productName}</span>
                        <div className="sm:hidden mt-1 space-y-0.5 text-xs text-gray-500">
                          <span>{formatDate(item.date)}</span>
                          <br />
                          <span>Shipped Units: {(item as any).boxesShipped ?? item.shippedQty}</span>
                          <br />
                          <span>Pack: {item.packOf}</span>
                          <br />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-left justify-start text-xs text-gray-500"
                            onClick={() => handleShipToClick(item.shipTo || "")}
                          >
                            <span>Ship To: {item.shipTo}</span>
                            <Eye className="h-3 w-3 ml-1 flex-shrink-0" />
                          </Button>
                          {item.remarks && (
                            <>
                              <br />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-left justify-start text-xs text-gray-500"
                                onClick={() => handleRemarksClick(item.remarks || "")}
                              >
                                <span>Remarks: {item.remarks}</span>
                                <Eye className="h-3 w-3 ml-1 flex-shrink-0" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs">{formatDate(item.date)}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{(item as any).boxesShipped ?? item.shippedQty}</TableCell>
                    <TableCell className="hidden md:table-cell">{item.packOf}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-left justify-start max-w-20 truncate"
                        onClick={() => handleShipToClick(item.shipTo || "")}
                      >
                        <span className="truncate">{item.shipTo}</span>
                        <Eye className="h-3 w-3 ml-1 flex-shrink-0" />
                      </Button>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {item.remarks ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-left justify-start max-w-20 truncate"
                          onClick={() => handleRemarksClick(item.remarks || "")}
                        >
                          <span className="truncate">{item.remarks}</span>
                          <Eye className="h-3 w-3 ml-1 flex-shrink-0" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-xs sm:text-sm text-gray-500">
                      {data.length === 0 ? "No shipped orders found." : "No orders match your search criteria."}
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

      {/* Remarks Dialog */}
      <Dialog open={isRemarksDialogOpen} onOpenChange={setIsRemarksDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Full Remarks</DialogTitle>
            <DialogDescription>Complete remarks for this shipment</DialogDescription>
          </DialogHeader>
          <div className="mt-4 overflow-y-auto max-h-[60vh]">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">
                {selectedRemarks || "No remarks available"}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ship To Dialog */}
      <Dialog open={isShipToDialogOpen} onOpenChange={setIsShipToDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Ship To Details</DialogTitle>
            <DialogDescription>Complete shipping address for this shipment</DialogDescription>
          </DialogHeader>
          <div className="mt-4 overflow-y-auto max-h-[60vh]">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">
                {selectedShipTo || "No shipping address available"}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
