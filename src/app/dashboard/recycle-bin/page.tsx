"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { RecycledInventoryItem } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Search, X, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function RecycleBinPage() {
  const { userProfile } = useAuth();
  const [recycleDateFilter, setRecycleDateFilter] = useState<string>("all");
  const [recycleSearch, setRecycleSearch] = useState("");
  const [recyclePage, setRecyclePage] = useState(1);
  const itemsPerPage = 10;

  const { 
    data: recycledInventory, 
    loading: recycledInventoryLoading 
  } = useCollection<RecycledInventoryItem>(
    userProfile ? `users/${userProfile.uid}/recycledInventory` : ""
  );

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date === 'string') return format(new Date(date), "MMM dd, yyyy");
    if (date.seconds) return format(new Date(date.seconds * 1000), "MMM dd, yyyy");
    return "N/A";
  };

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

  const filteredRecycledInventory = recycledInventory.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(recycleSearch.toLowerCase()) ||
                          (item.remarks && item.remarks.toLowerCase().includes(recycleSearch.toLowerCase())) ||
                          item.recycledBy.toLowerCase().includes(recycleSearch.toLowerCase());
    const matchesDate = matchesDateFilter(item.recycledAt, recycleDateFilter);
    return matchesSearch && matchesDate;
  });

  const totalRecyclePages = Math.ceil(filteredRecycledInventory.length / itemsPerPage);
  const startRecycleIndex = (recyclePage - 1) * itemsPerPage;
  const endRecycleIndex = startRecycleIndex + itemsPerPage;
  const paginatedRecycledInventory = filteredRecycledInventory
    .sort((a, b) => {
      const dateA = typeof a.recycledAt === 'string' ? new Date(a.recycledAt) : new Date(a.recycledAt?.seconds ? a.recycledAt.seconds * 1000 : 0);
      const dateB = typeof b.recycledAt === 'string' ? new Date(b.recycledAt) : new Date(b.recycledAt?.seconds ? b.recycledAt.seconds * 1000 : 0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startRecycleIndex, endRecycleIndex);
  const resetRecyclePagination = () => setRecyclePage(1);

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <RotateCcw className="h-6 w-6" />
                Disposed Inventory
              </CardTitle>
              <CardDescription className="text-orange-100 mt-2">
                View inventory items that were disposed by admins ({filteredRecycledInventory.length} records)
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <RotateCcw className="h-7 w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name, reason, or admin..."
                  value={recycleSearch}
                  onChange={(e) => setRecycleSearch(e.target.value)}
                  className="pl-10 h-11 shadow-sm"
                />
                {recycleSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setRecycleSearch("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={recycleDateFilter} onValueChange={(value) => {
                setRecycleDateFilter(value);
                resetRecyclePagination();
              }}>
                <SelectTrigger className="w-full sm:w-[200px] h-11 shadow-sm">
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

          {/* Content */}
          {recycledInventoryLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredRecycledInventory.length > 0 ? (
            <div className="space-y-4">
              {paginatedRecycledInventory.map((item) => (
                <div 
                  key={item.id}
                  className="group relative overflow-hidden rounded-xl border-2 border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50/50 p-5 shadow-md hover:shadow-lg transition-all duration-200 hover:border-orange-300"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{item.productName}</h3>
                          <Badge className="bg-orange-500 text-white shadow-md px-3 py-1">
                            Qty: {item.quantity}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Added: {formatDate(item.dateAdded)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-orange-600">Recycled:</span>
                            <span className="text-orange-700 font-semibold">{formatDate(item.recycledAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">By:</span>
                            <span className="text-gray-800">{item.recycledBy}</span>
                          </div>
                        </div>
                        {item.remarks && (
                          <div className="bg-white/60 rounded-lg p-3 border border-orange-200 mb-3">
                            <div className="flex items-start gap-2">
                              <RotateCcw className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-semibold text-orange-700">Reason: </span>
                                <span className="text-sm text-orange-800">{item.remarks}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        <Badge 
                          variant={item.status === "In Stock" ? "default" : "destructive"}
                          className="shadow-sm"
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <RotateCcw className="h-10 w-10 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">No recycled inventory items</h3>
              <p className="text-muted-foreground">
                {recycledInventory.length === 0 ? "No inventory items have been recycled yet." : "No recycled inventory items match your filters."}
              </p>
            </div>
          )}
          
          {/* Pagination */}
          {filteredRecycledInventory.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startRecycleIndex + 1} to {Math.min(endRecycleIndex, filteredRecycledInventory.length)} of {filteredRecycledInventory.length} records
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRecyclePage(p => Math.max(1, p - 1))}
                  disabled={recyclePage === 1}
                  className="shadow-sm"
                >
                  Previous
                </Button>
                <span className="text-sm font-medium px-3">
                  Page {recyclePage} of {totalRecyclePages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRecyclePage(p => Math.min(totalRecyclePages, p + 1))}
                  disabled={recyclePage === totalRecyclePages}
                  className="shadow-sm"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
