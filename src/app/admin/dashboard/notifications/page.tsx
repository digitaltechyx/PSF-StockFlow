"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile, InventoryItem, ShipmentRequest, InventoryRequest, ProductReturn } from "@/types";
import { db } from "@/lib/firebase";
import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { hasRole } from "@/lib/permissions";
import { ShipmentRequestsManagement } from "@/components/admin/shipment-requests-management";
import { InventoryRequestsManagement } from "@/components/admin/inventory-requests-management";
import { ProductReturnsManagement } from "@/components/admin/product-returns-management";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";

type NotificationType = "shipment_request" | "inventory_request" | "product_return";
type StatusFilter = "all" | "pending" | "paid" | "approved" | "confirmed" | "rejected" | "in_progress" | "closed" | "cancelled";

type NotificationRow = {
  type: NotificationType;
  id: string;
  userId: string;
  status: string;
  createdAtMs: number;
  title: string;
  subtitle?: string;
};

function normStatus(v: any): string {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^\w]/g, "")
    .replace(/_+/g, "_");
}

function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "string") {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof v === "object" && typeof v.seconds === "number") return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  return 0;
}

function inRange(ms: number, from?: Date, to?: Date): boolean {
  if (!from && !to) return true;
  const fromMs = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0).getTime() : null;
  const toMs = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, 0, 0).getTime() - 1 : null;
  if (fromMs !== null && ms < fromMs) return false;
  if (toMs !== null && ms > toMs) return false;
  return true;
}

export default function AdminNotificationsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const { data: users } = useCollection<UserProfile>("users");

  const usersById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    users.forEach((u: any) => {
      const id = u?.uid || u?.id;
      if (id) map.set(String(id), u);
    });
    return map;
  }, [users]);

  const [activeTab, setActiveTab] = useState<"all" | NotificationType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | NotificationType>("all");
  const [userIdFilter, setUserIdFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const [shipmentRequests, setShipmentRequests] = useState<NotificationRow[]>([]);
  const [inventoryRequests, setInventoryRequests] = useState<NotificationRow[]>([]);
  const [productReturns, setProductReturns] = useState<NotificationRow[]>([]);

  // Process modal
  const [processOpen, setProcessOpen] = useState(false);
  const [processType, setProcessType] = useState<NotificationType | null>(null);
  const [processUserId, setProcessUserId] = useState<string>("");
  const [processRequestId, setProcessRequestId] = useState<string>("");

  // inventory for selected user in process modal
  const processUser = usersById.get(processUserId) || null;
  const { data: processInventory } = useCollection<InventoryItem>(
    processUser?.uid ? `users/${processUser.uid}/inventory` : ""
  );

  useEffect(() => {
    if (!hasRole(userProfile, "admin") && !hasRole(userProfile, "sub_admin")) return;

    const userIds = users
      .map((u: any) => String(u?.uid || u?.id || ""))
      .filter((id) => id && id.trim() !== "");

    const run = async () => {
      setLoading(true);
      try {
        let anyFailed = false;

        // Shipment Requests
        {
          try {
            const base = collectionGroup(db, "shipmentRequests");
            const q = query(base);
            const snap = await getDocs(q);
            const rows: NotificationRow[] = snap.docs.map((d) => {
              const userId = d.ref.path.split("/")[1];
              const data = d.data() as any as ShipmentRequest;
              const dateMs = toMs((data as any).requestedAt) || toMs((data as any).date) || 0;
              const shipTo = (data as any).shipTo || "";
              return {
                type: "shipment_request",
                id: d.id,
                userId,
                status: String((data as any).status || ""),
                createdAtMs: dateMs,
                title: `Shipment Request • ${shipTo ? shipTo.substring(0, 40) : "N/A"}`,
                subtitle: `Items: ${(data as any).shipments?.length ?? 0}`,
              };
            });
            setShipmentRequests(rows);
          } catch (e) {
            // Fallback per-user (avoids collectionGroup limitations)
            anyFailed = true;
            const results = await Promise.all(userIds.map(async (uid) => {
              const base = collection(db, `users/${uid}/shipmentRequests`);
              const q = query(base);
              const snap = await getDocs(q);
              return snap.docs.map((d) => {
                const data = d.data() as any as ShipmentRequest;
                const dateMs = toMs((data as any).requestedAt) || toMs((data as any).date) || 0;
                const shipTo = (data as any).shipTo || "";
                const row: NotificationRow = {
                  type: "shipment_request",
                  id: d.id,
                  userId: uid,
                  status: String((data as any).status || ""),
                  createdAtMs: dateMs,
                  title: `Shipment Request • ${shipTo ? shipTo.substring(0, 40) : "N/A"}`,
                  subtitle: `Items: ${(data as any).shipments?.length ?? 0}`,
                };
                return row;
              });
            }));
            setShipmentRequests(results.flat());
          }
        }

        // Inventory Requests
        {
          try {
            const base = collectionGroup(db, "inventoryRequests");
            const q = query(base);
            const snap = await getDocs(q);
            const rows: NotificationRow[] = snap.docs.map((d) => {
              const userId = d.ref.path.split("/")[1];
              const data = d.data() as any as InventoryRequest;
              const dateMs = toMs((data as any).requestedAt) || toMs((data as any).addDate) || 0;
              const productName = (data as any).productName || (data as any).newProductName || "Inventory Request";
              return {
                type: "inventory_request",
                id: d.id,
                userId,
                status: String((data as any).status || ""),
                createdAtMs: dateMs,
                title: `Inventory Request • ${String(productName).substring(0, 50)}`,
                subtitle: `Qty: ${(data as any).quantity ?? (data as any).requestedQty ?? "N/A"}`,
              };
            });
            setInventoryRequests(rows);
          } catch (e) {
            anyFailed = true;
            const results = await Promise.all(userIds.map(async (uid) => {
              const base = collection(db, `users/${uid}/inventoryRequests`);
              const q = query(base);
              const snap = await getDocs(q);
              return snap.docs.map((d) => {
                const data = d.data() as any as InventoryRequest;
                const dateMs = toMs((data as any).requestedAt) || toMs((data as any).addDate) || 0;
                const productName = (data as any).productName || (data as any).newProductName || "Inventory Request";
                const row: NotificationRow = {
                  type: "inventory_request",
                  id: d.id,
                  userId: uid,
                  status: String((data as any).status || ""),
                  createdAtMs: dateMs,
                  title: `Inventory Request • ${String(productName).substring(0, 50)}`,
                  subtitle: `Qty: ${(data as any).quantity ?? (data as any).requestedQty ?? "N/A"}`,
                };
                return row;
              });
            }));
            setInventoryRequests(results.flat());
          }
        }

        // Product Returns
        {
          try {
            const base = collectionGroup(db, "productReturns");
            const q = query(base);
            const snap = await getDocs(q);
            const rows: NotificationRow[] = snap.docs.map((d) => {
              const userId = d.ref.path.split("/")[1];
              const data = d.data() as any as ProductReturn;
              const dateMs = toMs((data as any).createdAt) || toMs((data as any).updatedAt) || 0;
              const productName = (data as any).productName || (data as any).newProductName || "Product Return";
              return {
                type: "product_return",
                id: d.id,
                userId,
                status: String((data as any).status || ""),
                createdAtMs: dateMs,
                title: `Product Return • ${String(productName).substring(0, 50)}`,
                subtitle: `Req: ${(data as any).requestedQuantity ?? "N/A"} | Rec: ${(data as any).receivedQuantity ?? 0}`,
              };
            });
            setProductReturns(rows);
          } catch (e) {
            anyFailed = true;
            const results = await Promise.all(userIds.map(async (uid) => {
              const base = collection(db, `users/${uid}/productReturns`);
              const q = query(base);
              const snap = await getDocs(q);
              return snap.docs.map((d) => {
                const data = d.data() as any as ProductReturn;
                const dateMs = toMs((data as any).createdAt) || toMs((data as any).updatedAt) || 0;
                const productName = (data as any).productName || (data as any).newProductName || "Product Return";
                const row: NotificationRow = {
                  type: "product_return",
                  id: d.id,
                  userId: uid,
                  status: String((data as any).status || ""),
                  createdAtMs: dateMs,
                  title: `Product Return • ${String(productName).substring(0, 50)}`,
                  subtitle: `Req: ${(data as any).requestedQuantity ?? "N/A"} | Rec: ${(data as any).receivedQuantity ?? 0}`,
                };
                return row;
              });
            }));
            setProductReturns(results.flat());
          }
        }

        // Note: If anyFailed is true, we used per-user fallback instead of collectionGroup
        // This is expected when collectionGroup queries are blocked by Firestore security rules
        // The fallback works correctly and loads all notifications
        if (anyFailed) {
          console.log("Notifications: Using per-user fallback (collectionGroup queries not available)");
        }
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, users, toast]);

  const allRows = useMemo(() => {
    return [...shipmentRequests, ...inventoryRequests, ...productReturns]
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [shipmentRequests, inventoryRequests, productReturns]);

  const pendingCounts = useMemo(() => {
    const isPending = (r: NotificationRow) => {
      const s = normStatus(r.status);
      if (r.type === "shipment_request") return s === "pending";
      if (r.type === "inventory_request") return s === "pending";
      if (r.type === "product_return") return ["pending", "approved", "in_progress"].includes(s);
      return false;
    };
    const all = allRows.filter(isPending).length;
    const shipment = shipmentRequests.filter(isPending).length;
    const inv = inventoryRequests.filter(isPending).length;
    const pr = productReturns.filter(isPending).length;
    return { all, shipment, inv, pr };
  }, [allRows, shipmentRequests, inventoryRequests, productReturns]);

  const filteredRows = useMemo(() => {
    const byTab = (r: NotificationRow) => activeTab === "all" ? true : r.type === activeTab;
    const byType = (r: NotificationRow) => typeFilter === "all" ? true : r.type === typeFilter;
    const byUser = (r: NotificationRow) => {
      if (!userIdFilter || userIdFilter === "all") return true;
      return r.userId === userIdFilter;
    };
    const byDate = (r: NotificationRow) => inRange(r.createdAtMs, fromDate, toDate);
    const byStatus = (r: NotificationRow) =>
      statusFilter === "all" ? true : normStatus(r.status) === statusFilter;

    return allRows.filter((r) => byTab(r) && byType(r) && byUser(r) && byDate(r) && byStatus(r));
  }, [activeTab, allRows, fromDate, statusFilter, toDate, typeFilter, userIdFilter]);

  const openProcess = (row: NotificationRow) => {
    setProcessType(row.type);
    setProcessUserId(row.userId);
    setProcessRequestId(row.id);
    setProcessOpen(true);
  };

  const renderList = (rows: NotificationRow[]) => (
    <div className="space-y-2">
      {rows.map((r) => {
        const u = usersById.get(r.userId);
        const date = r.createdAtMs ? format(new Date(r.createdAtMs), "PPP p") : "N/A";
        return (
          <div key={`${r.type}-${r.userId}-${r.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg bg-background">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold truncate">{r.title}</div>
                <Badge variant="secondary">{r.status}</Badge>
                <Badge variant="outline">
                  {r.type === "shipment_request" ? "Shipment" : r.type === "inventory_request" ? "Inventory" : "Product Return"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <div>User: {u?.name || "Unknown"} ({u?.email || ""})</div>
                <div>Date: {date}</div>
                {r.subtitle && <div>{r.subtitle}</div>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openProcess(r)}>
                Process
              </Button>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-10">
          {loading ? "Loading..." : "No notifications found."}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Notifications</span>
            <Badge variant="secondary">Pending: {pendingCounts.all}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Type</div>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="shipment_request">Shipment Requests</SelectItem>
                  <SelectItem value="inventory_request">Inventory Requests</SelectItem>
                  <SelectItem value="product_return">Product Returns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">User</div>
              <Select value={userIdFilter} onValueChange={setUserIdFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {Array.from(usersById.entries())
                    .sort((a, b) => ((a[1].name || "").toLowerCase()).localeCompare((b[1].name || "").toLowerCase()))
                    .map(([id, u]) => (
                      <SelectItem key={id} value={id}>
                        {(u.name || "Unknown")} {u.email ? `(${u.email})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">From</div>
                <DatePicker date={fromDate} setDate={(d) => setFromDate(d)} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">To</div>
                <DatePicker date={toDate} setDate={(d) => setToDate(d)} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{pendingCounts.all}</Badge></TabsTrigger>
              <TabsTrigger value="shipment_request">Shipments <Badge variant="secondary" className="ml-2">{pendingCounts.shipment}</Badge></TabsTrigger>
              <TabsTrigger value="inventory_request">Inventory <Badge variant="secondary" className="ml-2">{pendingCounts.inv}</Badge></TabsTrigger>
              <TabsTrigger value="product_return">Returns <Badge variant="secondary" className="ml-2">{pendingCounts.pr}</Badge></TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {renderList(filteredRows)}
            </TabsContent>
            <TabsContent value="shipment_request" className="mt-4">
              {renderList(filteredRows.filter(r => r.type === "shipment_request"))}
            </TabsContent>
            <TabsContent value="inventory_request" className="mt-4">
              {renderList(filteredRows.filter(r => r.type === "inventory_request"))}
            </TabsContent>
            <TabsContent value="product_return" className="mt-4">
              {renderList(filteredRows.filter(r => r.type === "product_return"))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={processOpen} onOpenChange={setProcessOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Process Request</DialogTitle>
            <DialogDescription>
              Process the request using the same controls as the user-specific pages.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-2">
            {processType === "shipment_request" && (
              <ShipmentRequestsManagement
                selectedUser={processUser}
                inventory={processInventory}
                initialRequestId={processRequestId}
              />
            )}
            {processType === "inventory_request" && (
              <InventoryRequestsManagement
                selectedUser={processUser}
                initialRequestId={processRequestId}
              />
            )}
            {processType === "product_return" && (
              <ProductReturnsManagement
                selectedUser={processUser}
                inventory={processInventory}
                initialReturnId={processRequestId}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

