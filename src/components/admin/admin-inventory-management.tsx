"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, updateDoc, deleteDoc, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Package, Eye, EyeOff, Search, Filter, X, Download, History, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import type { InventoryItem, ShippedItem, UserProfile, RestockHistory, RecycledShippedItem, RecycledRestockHistory, RecycledInventoryItem } from "@/types";
import { arrayToCSV, downloadCSV, formatDateForCSV, type InventoryCSVRow, type ShippedCSVRow } from "@/lib/csv-utils";
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";

interface AdminInventoryManagementProps {
  selectedUser: UserProfile | null;
  inventory: InventoryItem[];
  shipped: ShippedItem[];
  loading: boolean;
}

const editProductSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().min(0, "Quantity must be non-negative"),
});

const restockSchema = z.object({
  quantity: z.number().min(1, "Quantity must be at least 1"),
});

export function AdminInventoryManagement({
  selectedUser,
  inventory,
  shipped,
  loading
}: AdminInventoryManagementProps) {
  const { toast } = useToast();
  const { userProfile: adminUser } = useAuth();
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<InventoryItem | null>(null);
  const [showShipped, setShowShipped] = useState(false);
  const [showRestockHistory, setShowRestockHistory] = useState(false);
  const [showRecycleSection, setShowRecycleSection] = useState(false);

  // Fetch restock history
  const { data: restockHistory, loading: restockHistoryLoading } = useCollection<RestockHistory>(
    selectedUser ? `users/${selectedUser.uid}/restockHistory` : ""
  );

  // Fetch recycled items
  const { data: recycledShipped, loading: recycledShippedLoading } = useCollection<RecycledShippedItem>(
    selectedUser ? `users/${selectedUser.uid}/recycledShipped` : ""
  );

  const { data: recycledRestockHistory, loading: recycledRestockHistoryLoading } = useCollection<RecycledRestockHistory>(
    selectedUser ? `users/${selectedUser.uid}/recycledRestockHistory` : ""
  );

  const { data: recycledInventory, loading: recycledInventoryLoading } = useCollection<RecycledInventoryItem>(
    selectedUser ? `users/${selectedUser.uid}/recycledInventory` : ""
  );
  
  // Search and filter states
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<string>("all");
  const [inventoryDateFilter, setInventoryDateFilter] = useState<string>("all");
  const [shippedSearch, setShippedSearch] = useState("");
  const [shippedDateFilter, setShippedDateFilter] = useState<string>("all");
  const [restockDateFilter, setRestockDateFilter] = useState<string>("all");

  const editForm = useForm<z.infer<typeof editProductSchema>>({
    resolver: zodResolver(editProductSchema),
    defaultValues: {
      productName: "",
      quantity: 0,
    },
  });

  const restockForm = useForm<z.infer<typeof restockSchema>>({
    resolver: zodResolver(restockSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  const handleEditProduct = (product: InventoryItem) => {
    setEditingProduct(product);
    editForm.setValue("productName", product.productName);
    editForm.setValue("quantity", product.quantity);
  };

  const handleRestockProduct = (product: InventoryItem) => {
    setRestockingProduct(product);
    restockForm.setValue("quantity", 1);
  };

  const onEditSubmit = async (values: z.infer<typeof editProductSchema>) => {
    if (!editingProduct || !selectedUser) return;

    try {
      const productRef = doc(db, `users/${selectedUser.uid}/inventory`, editingProduct.id);
      await updateDoc(productRef, {
        productName: values.productName,
        quantity: values.quantity,
        status: values.quantity > 0 ? "In Stock" : "Out of Stock",
      });

      toast({
        title: "Success",
        description: "Product updated successfully!",
      });
      setEditingProduct(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update product.",
      });
    }
  };

  const onRestockSubmit = async (values: z.infer<typeof restockSchema>) => {
    if (!restockingProduct || !selectedUser || !adminUser) return;

    try {
      const productRef = doc(db, `users/${selectedUser.uid}/inventory`, restockingProduct.id);
      const previousQuantity = restockingProduct.quantity;
      const newQuantity = previousQuantity + values.quantity;
      
      // Update the product quantity
      await updateDoc(productRef, {
        quantity: newQuantity,
        status: "In Stock",
      });

      // Record restock history
      const restockHistoryRef = collection(db, `users/${selectedUser.uid}/restockHistory`);
      await addDoc(restockHistoryRef, {
        productName: restockingProduct.productName,
        previousQuantity: previousQuantity,
        restockedQuantity: values.quantity,
        newQuantity: newQuantity,
        restockedBy: adminUser.name || "Admin",
        restockedAt: new Date(),
      });

      toast({
        title: "Success",
        description: `Product restocked! Previous: ${previousQuantity}, Added: ${values.quantity}, New Total: ${newQuantity}`,
      });
      setRestockingProduct(null);
      restockForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to restock product.",
      });
    }
  };

  const handleDeleteProduct = async (product: InventoryItem) => {
    if (!selectedUser) return;

    try {
      const productRef = doc(db, `users/${selectedUser.uid}/inventory`, product.id);
      await deleteDoc(productRef);

      toast({
        title: "Success",
        description: "Product deleted successfully!",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete product.",
      });
    }
  };

  const handleDeleteRestockHistory = async (restockItem: RestockHistory) => {
    if (!selectedUser) return;

    try {
      const restockRef = doc(db, `users/${selectedUser.uid}/restockHistory`, restockItem.id);
      await deleteDoc(restockRef);

      toast({
        title: "Success",
        description: `Restock history for "${restockItem.productName}" deleted successfully!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete restock history.",
      });
    }
  };

  const handleDeleteShippedOrder = async (shippedItem: ShippedItem) => {
    if (!selectedUser) return;

    try {
      const shippedRef = doc(db, `users/${selectedUser.uid}/shipped`, shippedItem.id);
      await deleteDoc(shippedRef);

      toast({
        title: "Success",
        description: `Shipped order for "${shippedItem.productName}" deleted successfully!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete shipped order.",
      });
    }
  };

  const handleRecycleShippedOrder = async (shippedItem: ShippedItem) => {
    if (!selectedUser || !adminUser) return;

    try {
      // Add to recycled collection
      const recycledRef = collection(db, `users/${selectedUser.uid}/recycledShipped`);
      await addDoc(recycledRef, {
        ...shippedItem,
        recycledAt: new Date(),
        recycledBy: adminUser.name || "Admin",
      });

      // Delete from original collection
      const shippedRef = doc(db, `users/${selectedUser.uid}/shipped`, shippedItem.id);
      await deleteDoc(shippedRef);

      toast({
        title: "Success",
        description: `Shipped order for "${shippedItem.productName}" moved to recycle bin!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to recycle shipped order.",
      });
    }
  };

  const handleRecycleRestockHistory = async (restockItem: RestockHistory) => {
    if (!selectedUser || !adminUser) return;

    try {
      // Add to recycled collection
      const recycledRef = collection(db, `users/${selectedUser.uid}/recycledRestockHistory`);
      await addDoc(recycledRef, {
        ...restockItem,
        recycledAt: new Date(),
        recycledBy: adminUser.name || "Admin",
      });

      // Delete from original collection
      const restockRef = doc(db, `users/${selectedUser.uid}/restockHistory`, restockItem.id);
      await deleteDoc(restockRef);

      toast({
        title: "Success",
        description: `Restock history for "${restockItem.productName}" moved to recycle bin!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to recycle restock history.",
      });
    }
  };

  const handleRestoreShippedOrder = async (recycledItem: RecycledShippedItem) => {
    if (!selectedUser || !adminUser) return;

    try {
      // Add back to original collection
      const shippedRef = collection(db, `users/${selectedUser.uid}/shipped`);
      await addDoc(shippedRef, {
        productName: recycledItem.productName,
        date: recycledItem.date,
        shippedQty: recycledItem.shippedQty,
        remainingQty: recycledItem.remainingQty,
        packOf: recycledItem.packOf,
        remarks: recycledItem.remarks,
      });

      // Delete from recycled collection
      const recycledRef = doc(db, `users/${selectedUser.uid}/recycledShipped`, recycledItem.id);
      await deleteDoc(recycledRef);

      toast({
        title: "Success",
        description: `Shipped order for "${recycledItem.productName}" restored successfully!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to restore shipped order.",
      });
    }
  };

  const handleRestoreRestockHistory = async (recycledItem: RecycledRestockHistory) => {
    if (!selectedUser || !adminUser) return;

    try {
      // Add back to original collection
      const restockRef = collection(db, `users/${selectedUser.uid}/restockHistory`);
      await addDoc(restockRef, {
        productName: recycledItem.productName,
        previousQuantity: recycledItem.previousQuantity,
        restockedQuantity: recycledItem.restockedQuantity,
        newQuantity: recycledItem.newQuantity,
        restockedBy: recycledItem.restockedBy,
        restockedAt: recycledItem.restockedAt,
      });

      // Delete from recycled collection
      const recycledRef = doc(db, `users/${selectedUser.uid}/recycledRestockHistory`, recycledItem.id);
      await deleteDoc(recycledRef);

      toast({
        title: "Success",
        description: `Restock history for "${recycledItem.productName}" restored successfully!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to restore restock history.",
      });
    }
  };

  const handleRecycleInventoryItem = async (inventoryItem: InventoryItem) => {
    if (!selectedUser || !adminUser) return;

    try {
      // Add to recycled collection
      const recycledRef = collection(db, `users/${selectedUser.uid}/recycledInventory`);
      await addDoc(recycledRef, {
        ...inventoryItem,
        recycledAt: new Date(),
        recycledBy: adminUser.name || "Admin",
      });

      // Delete from original collection
      const inventoryRef = doc(db, `users/${selectedUser.uid}/inventory`, inventoryItem.id);
      await deleteDoc(inventoryRef);

      toast({
        title: "Success",
        description: `Inventory item "${inventoryItem.productName}" moved to recycle bin!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to recycle inventory item.",
      });
    }
  };

  const handleRestoreInventoryItem = async (recycledItem: RecycledInventoryItem) => {
    if (!selectedUser || !adminUser) return;

    try {
      // Add back to original collection
      const inventoryRef = collection(db, `users/${selectedUser.uid}/inventory`);
      await addDoc(inventoryRef, {
        productName: recycledItem.productName,
        quantity: recycledItem.quantity,
        dateAdded: recycledItem.dateAdded,
        status: recycledItem.status,
      });

      // Delete from recycled collection
      const recycledRef = doc(db, `users/${selectedUser.uid}/recycledInventory`, recycledItem.id);
      await deleteDoc(recycledRef);

      toast({
        title: "Success",
        description: `Inventory item "${recycledItem.productName}" restored successfully!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to restore inventory item.",
      });
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date === 'string') return date;
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

  // Download functions
  const handleDownloadInventory = () => {
    if (!selectedUser || filteredInventory.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No inventory data available to download.",
      });
      return;
    }

    const csvData: InventoryCSVRow[] = filteredInventory.map(item => ({
      'Product Name': item.productName,
      'Quantity': item.quantity,
      'Status': item.status,
      'Date Added': formatDateForCSV(item.dateAdded),
    }));

    const csvContent = arrayToCSV(csvData, ['Product Name', 'Quantity', 'Status', 'Date Added']);
    const filename = `${selectedUser.name}_inventory_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    
    toast({
      title: "Download Started",
      description: `Inventory data for ${selectedUser.name} is being downloaded.`,
    });
  };

  const handleDownloadShipped = () => {
    if (!selectedUser || filteredShipped.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No shipped orders data available to download.",
      });
      return;
    }

    const csvData: ShippedCSVRow[] = filteredShipped.map(item => ({
      'Product Name': item.productName,
      'Shipped Quantity': item.shippedQty,
      'Pack Of': item.packOf,
      'Date Shipped': formatDateForCSV(item.date),
      'Remarks': item.remarks || '',
    }));

    const csvContent = arrayToCSV(csvData, ['Product Name', 'Shipped Quantity', 'Pack Of', 'Date Shipped', 'Remarks']);
    const filename = `${selectedUser.name}_shipped_orders_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
    
    toast({
      title: "Download Started",
      description: `Shipped orders data for ${selectedUser.name} is being downloaded.`,
    });
  };

  // Filtered inventory data
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch = item.productName.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchesStatus = inventoryStatusFilter === "all" || item.status === inventoryStatusFilter;
      const matchesDate = matchesDateFilter(item.dateAdded, inventoryDateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [inventory, inventorySearch, inventoryStatusFilter, inventoryDateFilter]);

  // Filtered shipped data
  const filteredShipped = useMemo(() => {
    return shipped.filter((item) => {
      const matchesSearch = item.productName.toLowerCase().includes(shippedSearch.toLowerCase());
      const matchesDate = matchesDateFilter(item.date, shippedDateFilter);
      return matchesSearch && matchesDate;
    });
  }, [shipped, shippedSearch, shippedDateFilter]);

  // Filtered restock history data
  const filteredRestockHistory = useMemo(() => {
    return restockHistory.filter((item) => {
      const matchesDate = matchesDateFilter(item.restockedAt, restockDateFilter);
      return matchesDate;
    });
  }, [restockHistory, restockDateFilter]);

  if (!selectedUser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
          <CardDescription>Select a user to manage their inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No user selected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Info Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Managing: {selectedUser.name}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShipped(!showShipped)}
              >
                {showShipped ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showShipped ? "Hide" : "Show"} Shipped Orders
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRestockHistory(!showRestockHistory)}
              >
                <History className="h-4 w-4 mr-2" />
                {showRestockHistory ? "Hide" : "Show"} Restock History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecycleSection(!showRecycleSection)}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {showRecycleSection ? "Hide" : "Show"} Recycle Bin
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Email: {selectedUser.email} | Phone: {selectedUser.phone || "Not provided"}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Current Inventory */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Inventory ({filteredInventory.length})</CardTitle>
              <CardDescription>Manage products in {selectedUser.name}'s inventory</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadInventory}
              disabled={filteredInventory.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="pl-10"
                />
                {inventorySearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setInventorySearch("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={inventoryStatusFilter} onValueChange={setInventoryStatusFilter}>
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
            <div className="sm:w-48">
              <Select value={inventoryDateFilter} onValueChange={setInventoryDateFilter}>
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
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredInventory.length > 0 ? (
            <div className="space-y-3">
              {filteredInventory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.productName}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>Qty: {item.quantity}</span>
                      <span>Added: {formatDate(item.dateAdded)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.status === "In Stock" ? "default" : "destructive"}>
                      {item.status}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditProduct(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestockProduct(item)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Recycle Product</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to move "{item.productName}" to the recycle bin? 
                              You can restore it later from the recycle section.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRecycleInventoryItem(item)}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              Recycle
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Product</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete "{item.productName}"? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProduct(item)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No inventory items</h3>
              <p className="text-muted-foreground">This user has no products in their inventory.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipped Orders (Conditional) */}
      {showShipped && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Shipped Orders ({filteredShipped.length})</CardTitle>
                <CardDescription>View shipped orders for {selectedUser.name}</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadShipped}
                disabled={filteredShipped.length === 0}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search and Filter Controls for Shipped Orders */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search shipped orders..."
                    value={shippedSearch}
                    onChange={(e) => setShippedSearch(e.target.value)}
                    className="pl-10"
                  />
                  {shippedSearch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setShippedSearch("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="sm:w-48">
                <Select value={shippedDateFilter} onValueChange={setShippedDateFilter}>
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
            
            {filteredShipped.length > 0 ? (
              <div className="space-y-3">
                {filteredShipped.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.productName}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Shipped: {item.shippedQty} units</span>
                        <span>Remaining: {item.remainingQty}</span>
                        <span>Pack: {item.packOf}</span>
                        <span>Date: {formatDate(item.date)}</span>
                      </div>
                      {item.remarks && (
                        <p className="text-sm text-muted-foreground mt-1">Remarks: {item.remarks}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Shipped Order</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this shipped order for "{item.productName}"? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteShippedOrder(item)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No shipped orders</h3>
                <p className="text-muted-foreground">No orders have been shipped yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Restock History (Conditional) */}
      {showRestockHistory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Restock History ({filteredRestockHistory.length})</CardTitle>
                <CardDescription>View restock history for {selectedUser.name}</CardDescription>
              </div>
              <div className="sm:w-48">
                <Select value={restockDateFilter} onValueChange={setRestockDateFilter}>
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
                {filteredRestockHistory
                  .sort((a, b) => {
                    const dateA = typeof a.restockedAt === 'string' ? new Date(a.restockedAt) : new Date(a.restockedAt.seconds * 1000);
                    const dateB = typeof b.restockedAt === 'string' ? new Date(b.restockedAt) : new Date(b.restockedAt.seconds * 1000);
                    return dateB.getTime() - dateA.getTime(); // Sort by newest first
                  })
                  .map((item) => (
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
                      <div className="flex items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Restock History</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this restock history for "{item.productName}"? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRestockHistory(item)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
          </CardContent>
        </Card>
      )}

      {/* Recycle Section */}
      {showRecycleSection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-orange-600">Recycle Bin</CardTitle>
            <CardDescription>View and restore recycled items for {selectedUser.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Recycled Inventory Items */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Recycled Inventory Items ({recycledInventory.length})</h3>
                {recycledInventoryLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : recycledInventory.length > 0 ? (
                  <div className="space-y-3">
                    {recycledInventory
                      .sort((a, b) => {
                        const dateA = typeof a.recycledAt === 'string' ? new Date(a.recycledAt) : new Date(a.recycledAt.seconds * 1000);
                        const dateB = typeof b.recycledAt === 'string' ? new Date(b.recycledAt) : new Date(b.recycledAt.seconds * 1000);
                        return dateB.getTime() - dateA.getTime();
                      })
                      .map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-orange-50">
                          <div className="flex-1">
                            <h4 className="font-semibold">{item.productName}</h4>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span>Qty: {item.quantity}</span>
                              <span>Added: {formatDate(item.dateAdded)}</span>
                              <span className="text-orange-600">Recycled: {formatDate(item.recycledAt)}</span>
                              <span>By: {item.recycledBy}</span>
                            </div>
                            <div className="mt-2">
                              <Badge variant={item.status === "In Stock" ? "default" : "destructive"}>
                                {item.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreInventoryItem(item)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restore
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <RotateCcw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No recycled inventory items</h3>
                    <p className="text-muted-foreground">No inventory items have been recycled yet.</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product details</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter product name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter quantity" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Update Product</Button>
                <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Restock Product Dialog */}
      <Dialog open={!!restockingProduct} onOpenChange={() => setRestockingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restock Product</DialogTitle>
            <DialogDescription>Add inventory to "{restockingProduct?.productName}"</DialogDescription>
          </DialogHeader>
          <Form {...restockForm}>
            <form onSubmit={restockForm.handleSubmit(onRestockSubmit)} className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Current Quantity:</strong> {restockingProduct?.quantity}
                </p>
                <p className="text-sm">
                  <strong>Product:</strong> {restockingProduct?.productName}
                </p>
              </div>
              <FormField
                control={restockForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Add</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter quantity to add" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Restock Product</Button>
                <Button type="button" variant="outline" onClick={() => setRestockingProduct(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
