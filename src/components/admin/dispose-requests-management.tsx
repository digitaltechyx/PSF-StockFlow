"use client";

import { useState, useMemo, useEffect } from "react";
import type { DisposeRequest, UserProfile, InventoryItem } from "@/types";
import { useCollection } from "@/hooks/use-collection";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, deleteDoc, runTransaction, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Eye, Loader2, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(date: DisposeRequest["requestedAt"]) {
  if (!date) return "N/A";
  if (typeof date === "string") return format(new Date(date), "PPP");
  if (date && typeof date === "object" && "seconds" in date) return format(new Date(date.seconds * 1000), "PPP");
  return "N/A";
}

export function DisposeRequestsManagement({
  selectedUser,
  inventory,
  initialRequestId,
}: {
  selectedUser: UserProfile | null;
  inventory: InventoryItem[];
  initialRequestId?: string;
}) {
  const { toast } = useToast();
  const { userProfile: adminProfile } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<DisposeRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rejectFeedback, setRejectFeedback] = useState("");

  const userId = selectedUser?.uid;
  const isValidUserId = userId && typeof userId === "string" && userId.trim() !== "";

  const { data: requests, loading } = useCollection<DisposeRequest>(
    isValidUserId ? `users/${userId}/disposeRequests` : ""
  );

  useEffect(() => {
    if (!initialRequestId || !requests?.length) return;
    const match = requests.find((r: DisposeRequest) => r.id === initialRequestId);
    if (match) setSelectedRequest(match);
  }, [initialRequestId, requests]);

  const filteredRequests = useMemo(() => {
    let list = statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);
    return [...list].sort((a, b) => {
      const msA = a.requestedAt && typeof a.requestedAt === "object" && "seconds" in a.requestedAt ? a.requestedAt.seconds * 1000 : 0;
      const msB = b.requestedAt && typeof b.requestedAt === "object" && "seconds" in b.requestedAt ? b.requestedAt.seconds * 1000 : 0;
      return msB - msA;
    });
  }, [requests, statusFilter]);

  const closeDialog = () => {
    setSelectedRequest(null);
    setRejectFeedback("");
  };

  const handleApprove = async (request: DisposeRequest) => {
    if (!selectedUser || !adminProfile) return;
    if (!request.id) {
      toast({ variant: "destructive", title: "Error", description: "Request ID missing." });
      return;
    }
    const invItem = inventory.find((i) => i.id === request.productId);
    if (!invItem) {
      toast({ variant: "destructive", title: "Product not found", description: "This product may have been removed from inventory." });
      return;
    }
    if (request.quantity > invItem.quantity) {
      toast({ variant: "destructive", title: "Insufficient quantity", description: `Available: ${invItem.quantity}. Requested: ${request.quantity}.` });
      return;
    }
    setIsProcessing(true);
    setRejectFeedback("");
    try {
      const requestRef = doc(db, `users/${userId}/disposeRequests`, request.id);
      const recycledCol = collection(db, `users/${userId}/recycledInventory`);
      const inventoryRef = doc(db, `users/${userId}/inventory`, invItem.id);

      await runTransaction(db, async (tx) => {
        const now = Timestamp.now();
        const adminName = adminProfile.name || "Admin";
        const newRecycledRef = doc(recycledCol);

        if (request.quantity >= invItem.quantity) {
          tx.set(newRecycledRef, {
            ...invItem,
            recycledAt: now,
            recycledBy: adminName,
            remarks: request.reason || "",
          });
          tx.delete(inventoryRef);
        } else {
          const newQty = invItem.quantity - request.quantity;
          const newStatus = newQty > 0 ? "In Stock" : "Out of Stock";
          tx.update(inventoryRef, { quantity: newQty, status: newStatus });
          tx.set(newRecycledRef, {
            productName: invItem.productName,
            quantity: request.quantity,
            dateAdded: invItem.dateAdded,
            status: invItem.status,
            recycledAt: now,
            recycledBy: adminName,
            remarks: request.reason || "",
          });
        }
        tx.update(requestRef, {
          status: "approved",
          approvedBy: adminProfile.uid,
          approvedAt: now,
        });
      });

      toast({ title: "Request approved", description: `${request.quantity} unit(s) of "${request.productName}" disposed.` });
      closeDialog();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed to approve", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (request: DisposeRequest) => {
    if (!selectedUser || !adminProfile) return;
    if (!request.id) {
      toast({ variant: "destructive", title: "Error", description: "Request ID missing." });
      return;
    }
    setIsProcessing(true);
    try {
      const requestRef = doc(db, `users/${userId}/disposeRequests`, request.id);
      const updateData: Record<string, unknown> = {
        status: "rejected",
        rejectedBy: adminProfile.uid,
        rejectedAt: Timestamp.now(),
      };
      if (rejectFeedback.trim()) updateData.adminFeedback = rejectFeedback.trim();
      await updateDoc(requestRef, updateData as Parameters<typeof updateDoc>[1]);
      toast({ title: "Request rejected", description: rejectFeedback.trim() ? "Feedback saved for the user." : "Request rejected." });
      closeDialog();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Failed to reject", description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isValidUserId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Select a user to view dispose requests.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Dispose Requests
          </CardTitle>
          <CardDescription>Approve to remove quantity from inventory (moved to disposed); reject with optional feedback.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : filteredRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No dispose requests found.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.productName}</TableCell>
                      <TableCell>{req.quantity}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={req.reason}>{req.reason}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(req.requestedAt)}</TableCell>
                      <TableCell>
                        <Badge variant={req.status === "pending" ? "secondary" : req.status === "approved" ? "default" : "destructive"}>
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {req.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => setSelectedRequest(req)}>
                            <Eye className="h-4 w-4 mr-1" /> Process
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Process dispose request</DialogTitle>
            <DialogDescription>
              Approve to remove the quantity from inventory (moved to disposed). Reject with optional feedback for the user.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <p><span className="font-medium">Product:</span> {selectedRequest.productName}</p>
                <p><span className="font-medium">Quantity:</span> {selectedRequest.quantity}</p>
                <p><span className="font-medium">Reason:</span> {selectedRequest.reason}</p>
                <p className="text-muted-foreground">Requested: {formatDate(selectedRequest.requestedAt)}</p>
              </div>
              <div className="space-y-2">
                <Label>Rejection feedback (optional)</Label>
                <Textarea
                  placeholder="Reason for rejection (shown to user)"
                  value={rejectFeedback}
                  onChange={(e) => setRejectFeedback(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => handleReject(selectedRequest)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                  Reject
                </Button>
                <Button onClick={() => handleApprove(selectedRequest)} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Approve & dispose
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
