"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { DeleteLog } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Search, X, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function DeleteLogsPage() {
  const { userProfile } = useAuth();
  const [deleteLogsDateFilter, setDeleteLogsDateFilter] = useState<string>("all");
  const [deleteLogsSearch, setDeleteLogsSearch] = useState("");
  const [deleteLogsPage, setDeleteLogsPage] = useState(1);
  const itemsPerPage = 10;

  const { 
    data: deleteLogs, 
    loading: deleteLogsLoading 
  } = useCollection<DeleteLog>(
    userProfile ? `users/${userProfile.uid}/deleteLogs` : ""
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

  const filteredDeleteLogs = deleteLogs.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(deleteLogsSearch.toLowerCase()) ||
                          item.reason.toLowerCase().includes(deleteLogsSearch.toLowerCase()) ||
                          item.deletedBy.toLowerCase().includes(deleteLogsSearch.toLowerCase());
    const matchesDate = matchesDateFilter(item.deletedAt, deleteLogsDateFilter);
    return matchesSearch && matchesDate;
  });

  const totalDeleteLogsPages = Math.ceil(filteredDeleteLogs.length / itemsPerPage);
  const startDeleteLogsIndex = (deleteLogsPage - 1) * itemsPerPage;
  const endDeleteLogsIndex = startDeleteLogsIndex + itemsPerPage;
  const paginatedDeleteLogs = filteredDeleteLogs
    .sort((a, b) => {
      const dateA = typeof a.deletedAt === 'string' ? new Date(a.deletedAt) : new Date(a.deletedAt?.seconds ? a.deletedAt.seconds * 1000 : 0);
      const dateB = typeof b.deletedAt === 'string' ? new Date(b.deletedAt) : new Date(b.deletedAt?.seconds ? b.deletedAt.seconds * 1000 : 0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startDeleteLogsIndex, endDeleteLogsIndex);
  const resetDeleteLogsPagination = () => setDeleteLogsPage(1);

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-red-500 to-rose-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Trash2 className="h-6 w-6" />
                Deleted Logs
              </CardTitle>
              <CardDescription className="text-red-100 mt-2">
                View products that were permanently deleted by admins ({filteredDeleteLogs.length} records)
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <AlertCircle className="h-7 w-7 text-white" />
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
                  value={deleteLogsSearch}
                  onChange={(e) => setDeleteLogsSearch(e.target.value)}
                  className="pl-10 h-11 shadow-sm"
                />
                {deleteLogsSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setDeleteLogsSearch("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={deleteLogsDateFilter} onValueChange={setDeleteLogsDateFilter}>
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
          {deleteLogsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : filteredDeleteLogs.length > 0 ? (
            <div className="space-y-4">
              {paginatedDeleteLogs.map((item) => (
                <div 
                  key={item.id}
                  className="group relative overflow-hidden rounded-xl border-2 border-red-100 bg-gradient-to-r from-red-50 to-rose-50/50 p-5 shadow-md hover:shadow-lg transition-all duration-200 hover:border-red-300"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{item.productName}</h3>
                          <Badge className="bg-red-500 text-white shadow-md px-3 py-1">
                            -{item.quantity}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Quantity:</span>
                            <span className="text-gray-800">{item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Added: {formatDate(item.dateAdded)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium text-red-600">Deleted:</span>
                            <span className="text-red-700 font-semibold">{formatDate(item.deletedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">By:</span>
                            <span className="text-gray-800">{item.deletedBy}</span>
                          </div>
                        </div>
                        <div className="bg-white/60 rounded-lg p-3 border border-red-200">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-red-700">Reason: </span>
                              <span className="text-sm text-red-800">{item.reason}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Badge 
                        variant={item.status === "In Stock" ? "default" : "destructive"}
                        className="shadow-sm"
                      >
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Trash2 className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">No deleted products</h3>
              <p className="text-muted-foreground">
                {deleteLogs.length === 0 ? "No products have been permanently deleted yet." : "No deletions match your filters."}
              </p>
            </div>
          )}
          
          {/* Pagination */}
          {filteredDeleteLogs.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startDeleteLogsIndex + 1} to {Math.min(endDeleteLogsIndex, filteredDeleteLogs.length)} of {filteredDeleteLogs.length} records
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteLogsPage(p => Math.max(1, p - 1))}
                  disabled={deleteLogsPage === 1}
                  className="shadow-sm"
                >
                  Previous
                </Button>
                <span className="text-sm font-medium px-3">
                  Page {deleteLogsPage} of {totalDeleteLogsPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteLogsPage(p => Math.min(totalDeleteLogsPages, p + 1))}
                  disabled={deleteLogsPage === totalDeleteLogsPages}
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
