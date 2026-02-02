"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { RecycledInventoryItem, InventoryItem, DisposeRequest } from "@/types";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, Search, X, Calendar, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function RecycleBinPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [recycleDateFilter, setRecycleDateFilter] = useState<string>("all");
  const [recycleSearch, setRecycleSearch] = useState("");
  const [recyclePage, setRecyclePage] = useState(1);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [disposeQuantity, setDisposeQuantity] = useState<string>("");
  const [disposeReason, setDisposeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const itemsPerPage = 10;

  const { 
    data: recycledInventory, 
    loading: recycledInventoryLoading 
  } = useCollection<RecycledInventoryItem>(
    userProfile ? `users/${userProfile.uid}/recycledInventory` : ""
  );

  const { data: inventory } = useCollection<InventoryItem>(
    userProfile ? `users/${userProfile.uid}/inventory` : ""
  );

  const { data: disposeRequests = [] } = useCollection<DisposeRequest & { id: string }>(
    userProfile ? `users/${userProfile.uid}/disposeRequests` : ""
  );

  const inStockInventory = inventory.filter((item) => item.quantity > 0);
  const selectedProduct = inStockInventory.find((p) => p.id === selectedProductId);
  const maxQty = selectedProduct?.quantity ?? 0;

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date === 'string') return format(new Date(date), "MMM dd, yyyy");
    if (date.seconds) return format(new Date(date.seconds * 1000), "MMM dd, yyyy");
    return "N/A";
  };

  const getRequestDate = (req: DisposeRequest) => {
    const raw = req.requestedAt;
    if (!raw) return null;
    if (typeof raw === 'string') return new Date(raw).getTime();
    if (raw.seconds) return raw.seconds * 1000;
    return null;
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

  type ListEntry =
    | { kind: "recycled"; item: RecycledInventoryItem }
    | { kind: "request"; item: DisposeRequest & { id: string } };

  const filteredRecycledInventory = recycledInventory.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(recycleSearch.toLowerCase()) ||
                          (item.remarks && item.remarks.toLowerCase().includes(recycleSearch.toLowerCase())) ||
                          item.recycledBy.toLowerCase().includes(recycleSearch.toLowerCase());
    const matchesDate = matchesDateFilter(item.recycledAt, recycleDateFilter);
    return matchesSearch && matchesDate;
  });

  const filteredDisposeRequests = disposeRequests.filter((req) => {
    const searchLower = recycleSearch.toLowerCase();
    const matchesSearch =
      !recycleSearch.trim() ||
      (req.productName && req.productName.toLowerCase().includes(searchLower)) ||
      (req.reason && req.reason.toLowerCase().includes(searchLower));
    const reqDateMs = getRequestDate(req);
    const matchesDate = !reqDateMs ? true : matchesDateFilter({ seconds: reqDateMs / 1000 }, recycleDateFilter);
    return matchesSearch && matchesDate;
  });

  const combinedList: ListEntry[] = [
    ...filteredRecycledInventory.map((item) => ({ kind: "recycled" as const, item })),
    ...filteredDisposeRequests.map((item) => ({ kind: "request" as const, item })),
  ].sort((a, b) => {
    const dateA = a.kind === "recycled"
      ? (typeof a.item.recycledAt === "string" ? new Date(a.item.recycledAt) : new Date((a.item.recycledAt as any)?.seconds ? (a.item.recycledAt as any).seconds * 1000 : 0)).getTime()
      : getRequestDate(a.item) ?? 0;
    const dateB = b.kind === "recycled"
      ? (typeof b.item.recycledAt === "string" ? new Date(b.item.recycledAt) : new Date((b.item.recycledAt as any)?.seconds ? (b.item.recycledAt as any).seconds * 1000 : 0)).getTime()
      : getRequestDate(b.item) ?? 0;
    return dateB - dateA;
  });

  const totalRecords = combinedList.length;
  const totalRecyclePages = Math.ceil(totalRecords / itemsPerPage);
  const startRecycleIndex = (recyclePage - 1) * itemsPerPage;
  const endRecycleIndex = startRecycleIndex + itemsPerPage;
  const paginatedList = combinedList.slice(startRecycleIndex, endRecycleIndex);
  const resetRecyclePagination = () => setRecyclePage(1);

  const handleSubmitDisposeRequest = async () => {
    if (!userProfile || !selectedProduct) return;
    const qty = parseInt(disposeQuantity, 10);
    if (!Number.isFinite(qty) || qty < 1 || qty > maxQty) {
      toast({ variant: "destructive", title: "Invalid quantity", description: `Enter a quantity between 1 and ${maxQty}.` });
      return;
    }
    if (!disposeReason.trim()) {
      toast({ variant: "destructive", title: "Reason required", description: "Please enter why you want to dispose this quantity." });
      return;
    }
    setSubmitting(true);
    try {
      const ref = collection(db, `users/${userProfile.uid}/disposeRequests`);
      await addDoc(ref, {
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        quantity: qty,
        reason: disposeReason.trim(),
        status: "pending",
        requestedAt: serverTimestamp(),
      });
      toast({ title: "Request submitted", description: "Your dispose request has been sent. An admin will review it." });
      setRequestDialogOpen(false);
      setSelectedProductId("");
      setDisposeQuantity("");
      setDisposeReason("");
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed to submit", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-600 text-white pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <RotateCcw className="h-6 w-6" />
                Disposed Inventory
              </CardTitle>
              <CardDescription className="text-orange-100 mt-2">
                View disposed items or request to dispose inventory ({totalRecords} records)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-white text-orange-600 hover:bg-orange-50 shadow-md">
                    <Plus className="h-4 w-4 mr-2" />
                    Request dispose
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Request to dispose inventory</DialogTitle>
                    <DialogDescription>
                      Select a product, quantity, and reason. An admin will approve or reject your request.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <Select value={selectedProductId} onValueChange={(v) => { setSelectedProductId(v); setDisposeQuantity(""); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {inStockInventory.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.productName} (available: {p.quantity})
                            </SelectItem>
                          ))}
                          {inStockInventory.length === 0 && (
                            <SelectItem value="_none" disabled>No products in stock</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedProduct && (
                      <>
                        <div className="space-y-2">
                          <Label>Quantity (max {maxQty})</Label>
                          <Input
                            type="number"
                            min={1}
                            max={maxQty}
                            value={disposeQuantity}
                            onChange={(e) => setDisposeQuantity(e.target.value)}
                            placeholder="e.g. 5"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Reason</Label>
                          <Textarea
                            value={disposeReason}
                            onChange={(e) => setDisposeReason(e.target.value)}
                            placeholder="Why do you want to dispose this quantity?"
                            rows={3}
                          />
                        </div>
                      </>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
                      <Button
                        onClick={handleSubmitDisposeRequest}
                        disabled={!selectedProduct || !disposeQuantity || !disposeReason.trim() || submitting}
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Submit request
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <RotateCcw className="h-7 w-7 text-white" />
              </div>
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
          ) : totalRecords > 0 ? (
            <div className="space-y-4">
              {paginatedList.map((entry) =>
                entry.kind === "recycled" ? (
                  <div
                    key={`recycled-${entry.item.id}`}
                    className="group relative overflow-hidden rounded-xl border-2 border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50/50 p-5 shadow-md hover:shadow-lg transition-all duration-200 hover:border-orange-300"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{entry.item.productName}</h3>
                            <Badge className="bg-orange-500 text-white shadow-md px-3 py-1">
                              Qty: {entry.item.quantity}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Added: {formatDate(entry.item.dateAdded)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-orange-600">Recycled:</span>
                              <span className="text-orange-700 font-semibold">{formatDate(entry.item.recycledAt)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="font-medium">By:</span>
                              <span className="text-gray-800">{entry.item.recycledBy}</span>
                            </div>
                          </div>
                          {entry.item.remarks && (
                            <div className="bg-white/60 rounded-lg p-3 border border-orange-200 mb-3">
                              <div className="flex items-start gap-2">
                                <RotateCcw className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="text-xs font-semibold text-orange-700">Reason: </span>
                                  <span className="text-sm text-orange-800">{entry.item.remarks}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          <Badge
                            variant={entry.item.status === "In Stock" ? "default" : "destructive"}
                            className="shadow-sm"
                          >
                            {entry.item.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`request-${entry.item.id}`}
                    className="group relative overflow-hidden rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/50 p-5 shadow-md hover:shadow-lg transition-all duration-200 hover:border-amber-400"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900">{entry.item.productName}</h3>
                            <Badge className="bg-amber-500 text-white shadow-md px-3 py-1">
                              Qty: {entry.item.quantity}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                entry.item.status === "pending"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : entry.item.status === "approved"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-red-100 text-red-800 border-red-300"
                              }
                            >
                              {entry.item.status.charAt(0).toUpperCase() + entry.item.status.slice(1)}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">Request</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Requested: {formatDate(entry.item.requestedAt)}</span>
                            </div>
                          </div>
                          <div className="bg-white/60 rounded-lg p-3 border border-amber-200 mb-3">
                            <div className="flex items-start gap-2">
                              <RotateCcw className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="text-xs font-semibold text-amber-700">Reason: </span>
                                <span className="text-sm text-amber-800">{entry.item.reason || "—"}</span>
                              </div>
                            </div>
                          </div>
                          {entry.item.adminFeedback && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Admin: {entry.item.adminFeedback}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="mx-auto h-20 w-20 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <RotateCcw className="h-10 w-10 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">No disposed items or requests</h3>
              <p className="text-muted-foreground">
                {recycledInventory.length === 0 && disposeRequests.length === 0
                  ? "No recycled inventory yet. Use \"Request dispose\" to submit a request."
                  : "No items or requests match your filters."}
              </p>
            </div>
          )}
          
          {/* Pagination */}
          {totalRecords > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startRecycleIndex + 1} to {Math.min(endRecycleIndex, totalRecords)} of {totalRecords} records
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
