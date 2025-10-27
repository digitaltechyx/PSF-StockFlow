"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { InventoryItem, ShippedItem, RestockHistory, DeleteLog, EditLog, RecycledInventoryItem, Invoice } from "@/types";
import { InvoicesSection } from "@/components/dashboard/invoices-section";
import { InventoryTable } from "@/components/dashboard/inventory-table";
import { ShippedTable } from "@/components/dashboard/shipped-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { History, Eye, EyeOff, Trash2, Edit, RotateCcw, Search, X, FileText } from "lucide-react";
import { format } from "date-fns";

export default function DashboardPage() {
  const { userProfile } = useAuth();
  const [showRestockHistory, setShowRestockHistory] = useState(false);
  const [showDeleteLogs, setShowDeleteLogs] = useState(false);
  const [showEditLogs, setShowEditLogs] = useState(false);
  const [showRecycleSection, setShowRecycleSection] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [restockDateFilter, setRestockDateFilter] = useState<string>("all");
  const [deleteLogsDateFilter, setDeleteLogsDateFilter] = useState<string>("all");
  const [editLogsDateFilter, setEditLogsDateFilter] = useState<string>("all");
  const [recycleDateFilter, setRecycleDateFilter] = useState<string>("all");
  const [deleteLogsSearch, setDeleteLogsSearch] = useState("");
  const [editLogsSearch, setEditLogsSearch] = useState("");
  const [recycleSearch, setRecycleSearch] = useState("");
  
  // Pagination states
  const [restockPage, setRestockPage] = useState(1);
  const [deleteLogsPage, setDeleteLogsPage] = useState(1);
  const [editLogsPage, setEditLogsPage] = useState(1);
  const [recyclePage, setRecyclePage] = useState(1);
  const itemsPerPage = 10;
  
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

  const { 
    data: deleteLogs, 
    loading: deleteLogsLoading 
  } = useCollection<DeleteLog>(
    userProfile ? `users/${userProfile.uid}/deleteLogs` : ""
  );

  const { 
    data: editLogs, 
    loading: editLogsLoading 
  } = useCollection<EditLog>(
    userProfile ? `users/${userProfile.uid}/editLogs` : ""
  );

  // Recycled items collections
  const { 
    data: recycledInventory, 
    loading: recycledInventoryLoading 
  } = useCollection<RecycledInventoryItem>(
    userProfile ? `users/${userProfile.uid}/recycledInventory` : ""
  );

  // Invoices collection
  const {
    data: invoices,
    loading: invoicesLoading
  } = useCollection<Invoice>(
    userProfile ? `users/${userProfile.uid}/invoices` : ""
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

  // Pagination calculations for restock history
  const totalRestockPages = Math.ceil(filteredRestockHistory.length / itemsPerPage);
  const startRestockIndex = (restockPage - 1) * itemsPerPage;
  const endRestockIndex = startRestockIndex + itemsPerPage;
  const paginatedRestockHistory = filteredRestockHistory
    .sort((a, b) => {
      const dateA = typeof a.restockedAt === 'string' ? new Date(a.restockedAt) : new Date(a.restockedAt.seconds * 1000);
      const dateB = typeof b.restockedAt === 'string' ? new Date(b.restockedAt) : new Date(b.restockedAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startRestockIndex, endRestockIndex);

  // Reset pagination when filters change
  const resetRestockPagination = () => setRestockPage(1);

  // Filtered delete logs data
  const filteredDeleteLogs = deleteLogs.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(deleteLogsSearch.toLowerCase()) ||
                          item.reason.toLowerCase().includes(deleteLogsSearch.toLowerCase()) ||
                          item.deletedBy.toLowerCase().includes(deleteLogsSearch.toLowerCase());
    const matchesDate = matchesDateFilter(item.deletedAt, deleteLogsDateFilter);
    return matchesSearch && matchesDate;
  });

  // Pagination for delete logs
  const totalDeleteLogsPages = Math.ceil(filteredDeleteLogs.length / itemsPerPage);
  const startDeleteLogsIndex = (deleteLogsPage - 1) * itemsPerPage;
  const endDeleteLogsIndex = startDeleteLogsIndex + itemsPerPage;
  const paginatedDeleteLogs = filteredDeleteLogs
    .sort((a, b) => {
      const dateA = typeof a.deletedAt === 'string' ? new Date(a.deletedAt) : new Date(a.deletedAt.seconds * 1000);
      const dateB = typeof b.deletedAt === 'string' ? new Date(b.deletedAt) : new Date(b.deletedAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startDeleteLogsIndex, endDeleteLogsIndex);
  const resetDeleteLogsPagination = () => setDeleteLogsPage(1);

  // Filtered edit logs data
  const filteredEditLogs = editLogs.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(editLogsSearch.toLowerCase()) ||
                          item.reason.toLowerCase().includes(editLogsSearch.toLowerCase()) ||
                          item.editedBy.toLowerCase().includes(editLogsSearch.toLowerCase()) ||
                          (item.previousProductName && item.previousProductName.toLowerCase().includes(editLogsSearch.toLowerCase()));
    const matchesDate = matchesDateFilter(item.editedAt, editLogsDateFilter);
    return matchesSearch && matchesDate;
  });

  // Pagination for edit logs
  const totalEditLogsPages = Math.ceil(filteredEditLogs.length / itemsPerPage);
  const startEditLogsIndex = (editLogsPage - 1) * itemsPerPage;
  const endEditLogsIndex = startEditLogsIndex + itemsPerPage;
  const paginatedEditLogs = filteredEditLogs
    .sort((a, b) => {
      const dateA = typeof a.editedAt === 'string' ? new Date(a.editedAt) : new Date(a.editedAt.seconds * 1000);
      const dateB = typeof b.editedAt === 'string' ? new Date(b.editedAt) : new Date(b.editedAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startEditLogsIndex, endEditLogsIndex);
  const resetEditLogsPagination = () => setEditLogsPage(1);

  // Filtered recycled data
  const filteredRecycledInventory = recycledInventory.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(recycleSearch.toLowerCase()) ||
                          (item.remarks && item.remarks.toLowerCase().includes(recycleSearch.toLowerCase())) ||
                          item.recycledBy.toLowerCase().includes(recycleSearch.toLowerCase());
    const matchesDate = matchesDateFilter(item.recycledAt, recycleDateFilter);
    return matchesSearch && matchesDate;
  });

  // Pagination for recycled inventory
  const totalRecyclePages = Math.ceil(filteredRecycledInventory.length / itemsPerPage);
  const startRecycleIndex = (recyclePage - 1) * itemsPerPage;
  const endRecycleIndex = startRecycleIndex + itemsPerPage;
  const paginatedRecycledInventory = filteredRecycledInventory
    .sort((a, b) => {
      const dateA = typeof a.recycledAt === 'string' ? new Date(a.recycledAt) : new Date(a.recycledAt.seconds * 1000);
      const dateB = typeof b.recycledAt === 'string' ? new Date(b.recycledAt) : new Date(b.recycledAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startRecycleIndex, endRecycleIndex);
  const resetRecyclePagination = () => setRecyclePage(1);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toggle Buttons */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRestockHistory(!showRestockHistory)}
          className="flex items-center gap-2"
        >
          <History className="h-4 w-4" />
          {showRestockHistory ? "Hide" : "Show"} Restock History
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeleteLogs(!showDeleteLogs)}
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {showDeleteLogs ? "Hide" : "Show"} Delete Logs
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEditLogs(!showEditLogs)}
          className="flex items-center gap-2"
        >
          <Edit className="h-4 w-4" />
          {showEditLogs ? "Hide" : "Show"} Edit Logs
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRecycleSection(!showRecycleSection)}
          className="flex items-center gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
        >
          <RotateCcw className="h-4 w-4" />
          {showRecycleSection ? "Hide" : "Show"} Recycle Bin
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInvoices(!showInvoices)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <FileText className="h-4 w-4" />
          {showInvoices ? "Hide" : "Show"} Invoices ({invoices.filter(inv => inv.status === 'pending').length})
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
                <Select value={restockDateFilter} onValueChange={(value) => {
                  setRestockDateFilter(value);
                  resetRestockPagination();
                }}>
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
                {paginatedRestockHistory.map((item) => (
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
            
            {/* Pagination Controls */}
            {filteredRestockHistory.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {startRestockIndex + 1} to {Math.min(endRestockIndex, filteredRestockHistory.length)} of {filteredRestockHistory.length} records
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRestockPage(p => Math.max(1, p - 1))}
                    disabled={restockPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {restockPage} of {totalRestockPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRestockPage(p => Math.min(totalRestockPages, p + 1))}
                    disabled={restockPage === totalRestockPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Logs Section */}
      {showDeleteLogs && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-red-600">Delete Logs ({filteredDeleteLogs.length})</CardTitle>
                <CardDescription>View products that were permanently deleted by admins</CardDescription>
              </div>
              <div className="sm:w-48">
                <Select value={deleteLogsDateFilter} onValueChange={setDeleteLogsDateFilter}>
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
            {/* Search Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by product name, reason, or admin..."
                    value={deleteLogsSearch}
                    onChange={(e) => setDeleteLogsSearch(e.target.value)}
                    className="pl-10"
                  />
                  {deleteLogsSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setDeleteLogsSearch("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {deleteLogsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredDeleteLogs.length > 0 ? (
              <div className="space-y-3">
                {paginatedDeleteLogs.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                      <div className="flex-1">
                        <h3 className="font-semibold text-red-800">{item.productName}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Quantity: {item.quantity}</span>
                          <span>Added: {formatDate(item.dateAdded)}</span>
                          <span className="text-red-600">Deleted: {formatDate(item.deletedAt)}</span>
                          <span>By: {item.deletedBy}</span>
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">Reason: </span>
                          <span className="text-red-700 font-medium">{item.reason}</span>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === "In Stock" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No deleted products</h3>
                <p className="text-muted-foreground">
                  {deleteLogs.length === 0 ? "No products have been permanently deleted yet." : "No deletions match your date filter."}
                </p>
              </div>
            )}
            
            {/* Pagination Controls */}
            {filteredDeleteLogs.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {startDeleteLogsIndex + 1} to {Math.min(endDeleteLogsIndex, filteredDeleteLogs.length)} of {filteredDeleteLogs.length} records
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteLogsPage(p => Math.max(1, p - 1))}
                    disabled={deleteLogsPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {deleteLogsPage} of {totalDeleteLogsPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteLogsPage(p => Math.min(totalDeleteLogsPages, p + 1))}
                    disabled={deleteLogsPage === totalDeleteLogsPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Logs Section */}
      {showEditLogs && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-blue-600">Edit Logs ({filteredEditLogs.length})</CardTitle>
                <CardDescription>View products that were edited by admins</CardDescription>
              </div>
              <div className="sm:w-48">
                <Select value={editLogsDateFilter} onValueChange={setEditLogsDateFilter}>
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
            {/* Search Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by product name, reason, or admin..."
                    value={editLogsSearch}
                    onChange={(e) => setEditLogsSearch(e.target.value)}
                    className="pl-10"
                  />
                  {editLogsSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setEditLogsSearch("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {editLogsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredEditLogs.length > 0 ? (
              <div className="space-y-3">
                {paginatedEditLogs.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-800">{item.productName}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Qty: {item.previousQuantity} → {item.newQuantity}</span>
                          <span>Status: {item.previousStatus} → {item.newStatus}</span>
                          <span className="text-blue-600">Edited: {formatDate(item.editedAt)}</span>
                          <span>By: {item.editedBy}</span>
                        </div>
                        {item.previousProductName && item.previousProductName !== item.productName && (
                          <div className="mt-1 text-sm">
                            <span className="text-muted-foreground">Name changed from: </span>
                            <span className="text-blue-700 font-medium">{item.previousProductName}</span>
                          </div>
                        )}
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">Reason: </span>
                          <span className="text-blue-700 font-medium">{item.reason}</span>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.newStatus === "In Stock" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {item.newStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Edit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No product edits</h3>
                <p className="text-muted-foreground">
                  {editLogs.length === 0 ? "No products have been edited yet." : "No edits match your date filter."}
                </p>
              </div>
            )}
            
            {/* Pagination Controls */}
            {filteredEditLogs.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {startEditLogsIndex + 1} to {Math.min(endEditLogsIndex, filteredEditLogs.length)} of {filteredEditLogs.length} records
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditLogsPage(p => Math.max(1, p - 1))}
                    disabled={editLogsPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {editLogsPage} of {totalEditLogsPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditLogsPage(p => Math.min(totalEditLogsPages, p + 1))}
                    disabled={editLogsPage === totalEditLogsPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recycle Section */}
      {showRecycleSection && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-orange-600">Recycled Inventory ({filteredRecycledInventory.length})</CardTitle>
                <CardDescription>View inventory items that were moved to recycle bin by admins</CardDescription>
              </div>
              <div className="sm:w-48">
                <Select value={recycleDateFilter} onValueChange={(value) => {
                  setRecycleDateFilter(value);
                  resetRecyclePagination();
                }}>
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
            {/* Search Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by product name, reason, or admin..."
                    value={recycleSearch}
                    onChange={(e) => setRecycleSearch(e.target.value)}
                    className="pl-10"
                  />
                  {recycleSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setRecycleSearch("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {recycledInventoryLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredRecycledInventory.length > 0 ? (
              <div className="space-y-3">
                {paginatedRecycledInventory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-orange-50">
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.productName}</h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Qty: {item.quantity}</span>
                          <span>Added: {formatDate(item.dateAdded)}</span>
                          <span className="text-orange-600">Recycled: {formatDate(item.recycledAt)}</span>
                          <span>By: {item.recycledBy}</span>
                        </div>
                        {item.remarks && (
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">Reason: </span>
                            <span className="text-orange-700 font-medium">{item.remarks}</span>
                          </div>
                        )}
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === "In Stock" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <RotateCcw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No recycled inventory items</h3>
                <p className="text-muted-foreground">
                  {recycledInventory.length === 0 ? "No inventory items have been recycled yet." : "No recycled inventory items match your date filter."}
                </p>
              </div>
            )}
            
            {/* Pagination Controls */}
            {filteredRecycledInventory.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {startRecycleIndex + 1} to {Math.min(endRecycleIndex, filteredRecycledInventory.length)} of {filteredRecycledInventory.length} records
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecyclePage(p => Math.max(1, p - 1))}
                    disabled={recyclePage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {recyclePage} of {totalRecyclePages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecyclePage(p => Math.min(totalRecyclePages, p + 1))}
                    disabled={recyclePage === totalRecyclePages}
                  >
                    Next
                  </Button>
                </div>
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

      {/* Invoices Section */}
      {showInvoices && (
        <InvoicesSection invoices={invoices} loading={invoicesLoading} />
      )}
    </div>
  );
}
