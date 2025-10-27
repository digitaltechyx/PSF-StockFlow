"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DatePicker } from "@/components/ui/date-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, updateDoc, deleteDoc, addDoc, collection, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Package, Eye, EyeOff, Search, Filter, X, Download, History, RotateCcw, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { InventoryItem, ShippedItem, UserProfile, RestockHistory, RecycledShippedItem, RecycledRestockHistory, RecycledInventoryItem, DeleteLog, EditLog } from "@/types";
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
  restockDate: z.date({ required_error: "A restock date is required." }),
});

const recycleSchema = z.object({
  quantity: z.number().min(1, "Quantity must be at least 1"),
  remarks: z.string().optional(),
});

const deleteSchema = z.object({
  reason: z.string().min(1, "Reason for deletion is required."),
});

const editLogSchema = z.object({
  reason: z.string().min(1, "Reason for editing is required."),
});

export function AdminInventoryManagement({
  selectedUser,
  inventory,
  shipped,
  loading
}: AdminInventoryManagementProps) {
  const { toast } = useToast();
  const { userProfile: adminUser } = useAuth();
  
  // Debug authentication state
  console.log("=== ADMIN INVENTORY MANAGEMENT DEBUG ===");
  console.log("Admin user:", adminUser);
  console.log("Admin user role:", adminUser?.role);
  console.log("Admin user UID:", adminUser?.uid);
  console.log("Selected user:", selectedUser);
  console.log("Inventory:", inventory);
  console.log("Loading:", loading);
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<InventoryItem | null>(null);
  const [recyclingProduct, setRecyclingProduct] = useState<InventoryItem | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<InventoryItem | null>(null);
  const [editingProductWithLog, setEditingProductWithLog] = useState<InventoryItem | null>(null);
  const [showShipped, setShowShipped] = useState(false);
  const [showRestockHistory, setShowRestockHistory] = useState(false);
  const [showRecycleSection, setShowRecycleSection] = useState(false);
  const [selectedRemarks, setSelectedRemarks] = useState<string>("");
  const [isRemarksDialogOpen, setIsRemarksDialogOpen] = useState(false);
  const [deleteLogsSearch, setDeleteLogsSearch] = useState("");
  const [editLogsSearch, setEditLogsSearch] = useState("");
  const [recycleSearch, setRecycleSearch] = useState("");
  const [deleteLogsDateFilter, setDeleteLogsDateFilter] = useState<string>("all");
  const [editLogsDateFilter, setEditLogsDateFilter] = useState<string>("all");
  const [recycleDateFilter, setRecycleDateFilter] = useState<string>("all");
  
  // Pagination states
  const [inventoryPage, setInventoryPage] = useState(1);
  const [shippedPage, setShippedPage] = useState(1);
  const [restockHistoryPage, setRestockHistoryPage] = useState(1);
  const [deleteLogsPage, setDeleteLogsPage] = useState(1);
  const [editLogsPage, setEditLogsPage] = useState(1);
  const [recyclePage, setRecyclePage] = useState(1);
  const itemsPerPage = 10;

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

  // Fetch delete logs
  const { data: deleteLogs, loading: deleteLogsLoading } = useCollection<DeleteLog>(
    selectedUser ? `users/${selectedUser.uid}/deleteLogs` : ""
  );

  // Fetch edit logs
  const { data: editLogs, loading: editLogsLoading } = useCollection<EditLog>(
    selectedUser ? `users/${selectedUser.uid}/editLogs` : ""
  );
  
  // Search and filter states
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<string>("all");
  const [inventoryDateFilter, setInventoryDateFilter] = useState<string>("all");
  const [inventorySortBy, setInventorySortBy] = useState<string>("name-asc");
  const [inventoryFromDate, setInventoryFromDate] = useState<Date | undefined>();
  const [inventoryToDate, setInventoryToDate] = useState<Date | undefined>();
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
      restockDate: new Date(),
    },
  });

  const recycleForm = useForm<z.infer<typeof recycleSchema>>({
    resolver: zodResolver(recycleSchema),
    defaultValues: {
      quantity: 1,
      remarks: "",
    },
  });

  const deleteForm = useForm<z.infer<typeof deleteSchema>>({
    resolver: zodResolver(deleteSchema),
    defaultValues: {
      reason: "",
    },
  });

  const editLogForm = useForm<z.infer<typeof editLogSchema>>({
    resolver: zodResolver(editLogSchema),
    defaultValues: {
      reason: "",
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
    restockForm.setValue("restockDate", new Date());
  };

  const handleRecycleProduct = (product: InventoryItem) => {
    setRecyclingProduct(product);
    recycleForm.setValue("quantity", 1);
    recycleForm.setValue("remarks", "");
  };

  const handleDeleteProduct = (product: InventoryItem) => {
    setDeletingProduct(product);
    deleteForm.setValue("reason", "");
  };

  const handleEditProductWithLog = (product: InventoryItem) => {
    setEditingProductWithLog(product);
    editLogForm.setValue("reason", "");
  };

  const handleRemarksClick = (remarks: string) => {
    setSelectedRemarks(remarks);
    setIsRemarksDialogOpen(true);
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

      // Record restock history with selected date
      const restockHistoryRef = collection(db, `users/${selectedUser.uid}/restockHistory`);
      await addDoc(restockHistoryRef, {
        productName: restockingProduct.productName,
        previousQuantity: previousQuantity,
        restockedQuantity: values.quantity,
        newQuantity: newQuantity,
        restockedBy: adminUser.name || "Admin",
        restockedAt: values.restockDate, // Use selected date instead of new Date()
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

  const onRecycleSubmit = async (values: z.infer<typeof recycleSchema>) => {
    if (!recyclingProduct) return;

    try {
      console.log("Recycle form submitted with values:", values);
      await handleRecycleInventoryItem(recyclingProduct, values.quantity, values.remarks);
      setRecyclingProduct(null);
      recycleForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to recycle product.",
      });
    }
  };

  const onDeleteSubmit = async (values: z.infer<typeof deleteSchema>) => {
    if (!deletingProduct || !selectedUser || !adminUser) return;

    try {
      // Log the deletion
      const deleteLogRef = collection(db, `users/${selectedUser.uid}/deleteLogs`);
      await addDoc(deleteLogRef, {
        productName: deletingProduct.productName,
        quantity: deletingProduct.quantity,
        dateAdded: deletingProduct.dateAdded,
        status: deletingProduct.status,
        deletedAt: new Date(),
        deletedBy: adminUser.name || "Admin",
        reason: values.reason,
      });

      // Delete the product
      const productRef = doc(db, `users/${selectedUser.uid}/inventory`, deletingProduct.id);
      await deleteDoc(productRef);

      toast({
        title: "Success",
        description: `Product "${deletingProduct.productName}" deleted successfully!`,
      });
      setDeletingProduct(null);
      deleteForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete product.",
      });
    }
  };

  const onEditWithLogSubmit = async (values: z.infer<typeof editLogSchema>) => {
    if (!editingProductWithLog || !selectedUser || !adminUser) return;

    try {
      // Get current product data
      const productRef = doc(db, `users/${selectedUser.uid}/inventory`, editingProductWithLog.id);
      const productDoc = await getDoc(productRef);
      
      if (!productDoc.exists()) {
        throw new Error("Product not found");
      }

      const currentData = productDoc.data() as Omit<InventoryItem, 'id'>;
      const previousProductName = currentData.productName;
      const previousQuantity = currentData.quantity;
      const previousStatus = currentData.status;

      // Update the product
      const newStatus = editForm.getValues("quantity") > 0 ? "In Stock" : "Out of Stock";
      await updateDoc(productRef, {
        productName: editForm.getValues("productName"),
        quantity: editForm.getValues("quantity"),
        status: newStatus,
      });

      // Log the edit
      const editLogRef = collection(db, `users/${selectedUser.uid}/editLogs`);
      const editLogData: any = {
        productName: editForm.getValues("productName"),
        previousQuantity: previousQuantity,
        newQuantity: editForm.getValues("quantity"),
        previousStatus: previousStatus,
        newStatus: newStatus,
        dateAdded: editingProductWithLog.dateAdded,
        editedAt: new Date(),
        editedBy: adminUser.name || "Admin",
        reason: values.reason,
      };

      // Only include previousProductName if it actually changed
      if (previousProductName !== editForm.getValues("productName")) {
        editLogData.previousProductName = previousProductName;
      }

      await addDoc(editLogRef, editLogData);

      toast({
        title: "Success",
        description: `Product "${editForm.getValues("productName")}" updated successfully!`,
      });
      setEditingProductWithLog(null);
      editLogForm.reset();
      editForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update product.",
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

  const handleRecycleInventoryItem = async (inventoryItem: InventoryItem, recycleQuantity: number, remarks?: string) => {
    if (!selectedUser || !adminUser) return;

    try {
      if (recycleQuantity >= inventoryItem.quantity) {
        // Recycle entire item
        const recycledRef = collection(db, `users/${selectedUser.uid}/recycledInventory`);
        await addDoc(recycledRef, {
          ...inventoryItem,
          recycledAt: new Date(),
          recycledBy: adminUser.name || "Admin",
          remarks: remarks || "",
        });

        // Delete from original collection
        const inventoryRef = doc(db, `users/${selectedUser.uid}/inventory`, inventoryItem.id);
        await deleteDoc(inventoryRef);

        toast({
          title: "Success",
          description: `Inventory item "${inventoryItem.productName}" (${recycleQuantity} units) moved to recycle bin!`,
        });
      } else {
        // Partial recycle - update original item and add to recycled
        const newQuantity = inventoryItem.quantity - recycleQuantity;
        const newStatus = newQuantity > 0 ? "In Stock" : "Out of Stock";

        // Update original inventory
        const inventoryRef = doc(db, `users/${selectedUser.uid}/inventory`, inventoryItem.id);
        await updateDoc(inventoryRef, {
          quantity: newQuantity,
          status: newStatus,
        });

        // Add partial quantity to recycled collection
        const recycledRef = collection(db, `users/${selectedUser.uid}/recycledInventory`);
        await addDoc(recycledRef, {
          productName: inventoryItem.productName,
          quantity: recycleQuantity,
          dateAdded: inventoryItem.dateAdded,
          status: inventoryItem.status,
          recycledAt: new Date(),
          recycledBy: adminUser.name || "Admin",
          remarks: remarks || "",
        });

        toast({
          title: "Success",
          description: `${recycleQuantity} units of "${inventoryItem.productName}" moved to recycle bin! ${newQuantity} units remaining.`,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to recycle inventory item.",
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
    
    const now = new Date();
    const itemDate = typeof date === 'string' ? new Date(date) : new Date(date.seconds * 1000);
    
    switch (filter) {
      case "today":
        return itemDate.toDateString() === now.toDateString();
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return itemDate >= weekAgo;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return itemDate >= monthAgo;
      case "year":
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return itemDate >= yearAgo;
      default:
        return true;
    }
  };

  // Filtered delete logs
  const filteredDeleteLogs = deleteLogs.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(deleteLogsSearch.toLowerCase()) ||
                          item.reason.toLowerCase().includes(deleteLogsSearch.toLowerCase()) ||
                          item.deletedBy.toLowerCase().includes(deleteLogsSearch.toLowerCase());
    const matchesDate = matchesDateFilter(item.deletedAt, deleteLogsDateFilter);
    return matchesSearch && matchesDate;
  }).sort((a, b) => {
    const dateA = typeof a.deletedAt === 'string' ? new Date(a.deletedAt) : new Date(a.deletedAt.seconds * 1000);
    const dateB = typeof b.deletedAt === 'string' ? new Date(b.deletedAt) : new Date(b.deletedAt.seconds * 1000);
    return dateB.getTime() - dateA.getTime();
  });

  // Pagination for delete logs
  const deleteLogsTotalPages = Math.ceil(filteredDeleteLogs.length / itemsPerPage);
  const deleteLogsStartIndex = (deleteLogsPage - 1) * itemsPerPage;
  const deleteLogsEndIndex = deleteLogsStartIndex + itemsPerPage;
  const paginatedDeleteLogs = filteredDeleteLogs.slice(deleteLogsStartIndex, deleteLogsEndIndex);
  const resetDeleteLogsPagination = () => setDeleteLogsPage(1);

  const filteredEditLogs = editLogs.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(editLogsSearch.toLowerCase()) ||
                          item.reason.toLowerCase().includes(editLogsSearch.toLowerCase()) ||
                          item.editedBy.toLowerCase().includes(editLogsSearch.toLowerCase()) ||
                          (item.previousProductName && item.previousProductName.toLowerCase().includes(editLogsSearch.toLowerCase()));
    const matchesDate = matchesDateFilter(item.editedAt, editLogsDateFilter);
    return matchesSearch && matchesDate;
  }).sort((a, b) => {
    const dateA = typeof a.editedAt === 'string' ? new Date(a.editedAt) : new Date(a.editedAt.seconds * 1000);
    const dateB = typeof b.editedAt === 'string' ? new Date(b.editedAt) : new Date(b.editedAt.seconds * 1000);
    return dateB.getTime() - dateA.getTime();
  });

  // Pagination for edit logs
  const editLogsTotalPages = Math.ceil(filteredEditLogs.length / itemsPerPage);
  const editLogsStartIndex = (editLogsPage - 1) * itemsPerPage;
  const editLogsEndIndex = editLogsStartIndex + itemsPerPage;
  const paginatedEditLogs = filteredEditLogs.slice(editLogsStartIndex, editLogsEndIndex);
  const resetEditLogsPagination = () => setEditLogsPage(1);

  const filteredRecycledInventory = recycledInventory.filter((item) => {
    const matchesSearch = item.productName.toLowerCase().includes(recycleSearch.toLowerCase()) ||
                          (item.remarks && item.remarks.toLowerCase().includes(recycleSearch.toLowerCase())) ||
                          item.recycledBy.toLowerCase().includes(recycleSearch.toLowerCase());
    const matchesDate = matchesDateFilter(item.recycledAt, recycleDateFilter);
    return matchesSearch && matchesDate;
  }).sort((a, b) => {
    const dateA = typeof a.recycledAt === 'string' ? new Date(a.recycledAt) : new Date(a.recycledAt.seconds * 1000);
    const dateB = typeof b.recycledAt === 'string' ? new Date(b.recycledAt) : new Date(b.recycledAt.seconds * 1000);
    return dateB.getTime() - dateA.getTime();
  });

  // Pagination for recycled inventory
  const recycleTotalPages = Math.ceil(filteredRecycledInventory.length / itemsPerPage);
  const recycleStartIndex = (recyclePage - 1) * itemsPerPage;
  const recycleEndIndex = recycleStartIndex + itemsPerPage;
  const paginatedRecycledInventory = filteredRecycledInventory.slice(recycleStartIndex, recycleEndIndex);
  const resetRecyclePagination = () => setRecyclePage(1);

  // Helper function for date picker filtering
  const matchesDatePickerFilter = (date: any, fromDate?: Date, toDate?: Date) => {
    if (!fromDate && !toDate) return true;
    
    let itemDate: Date;
    if (typeof date === 'string') {
      itemDate = new Date(date);
    } else if (date && typeof date === 'object' && date.seconds) {
      itemDate = new Date(date.seconds * 1000);
    } else {
      return false;
    }
    
    // Set time to start/end of day for accurate comparison
    const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    
    if (fromDate && toDate) {
      const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
      return itemDateOnly >= fromDateOnly && itemDateOnly <= toDateOnly;
    } else if (fromDate) {
      const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      return itemDateOnly >= fromDateOnly;
    } else if (toDate) {
      const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
      return itemDateOnly <= toDateOnly;
    }
    
    return true;
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

  const handleGenerateInvoice = async () => {
    if (!selectedUser) {
      toast({
        variant: "destructive",
        title: "No User Selected",
        description: "Please select a user first.",
      });
      return;
    }

    // Import invoice generator functions
    const { generateInvoicePDF, generateInvoiceNumber } = await import('@/lib/invoice-generator');
    
    // Get today's shipments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayShipments = filteredShipped.filter(shippedItem => {
      const shipmentDate = typeof shippedItem.date === 'string' 
        ? new Date(shippedItem.date) 
        : new Date(shippedItem.date.seconds * 1000);
      shipmentDate.setHours(0, 0, 0, 0);
      return shipmentDate.getTime() === today.getTime();
    });

    if (todayShipments.length === 0) {
      toast({
        variant: "destructive",
        title: "No Shipments Today",
        description: "No shipments found for today to generate invoice.",
      });
      return;
    }

    // Create invoice data
    const invoiceNumber = generateInvoiceNumber();
    const invoiceData = {
      invoiceNumber,
      date: format(today, 'MM/dd/yy'),
      orderNumber: `ORD-${format(today, 'yyyyMMdd')}-${Date.now().toString().slice(-4)}`,
      soldTo: {
        name: selectedUser.name,
        email: selectedUser.email,
        phone: selectedUser.phone || '',
        address: `${selectedUser.address || ''}`.trim(),
      },
      shipTo: todayShipments[0].shipTo || '',
      fbm: 'Standard Shipping',
      items: todayShipments.map(shipped => ({
        quantity: shipped.shippedQty,
        productName: shipped.productName,
        packaging: `${shipped.packOf} Nos.`,
        unitPrice: shipped.unitPrice || 0,
        amount: (shipped.shippedQty) * (shipped.unitPrice || 0),
      })),
    };

    // Calculate totals
    const subtotal = invoiceData.items.reduce((sum, item) => sum + item.amount, 0);
    const grandTotal = subtotal; // No tax added
    
    // Save invoice to Firestore
    const invoiceDoc = {
      invoiceNumber,
      date: invoiceData.date,
      orderNumber: invoiceData.orderNumber,
      soldTo: invoiceData.soldTo,
      shipTo: invoiceData.shipTo,
      fbm: invoiceData.fbm,
      items: invoiceData.items,
      subtotal,
      grandTotal,
      status: 'pending' as const,
      createdAt: new Date(),
      userId: selectedUser.uid,
    };
    
    await addDoc(collection(db, `users/${selectedUser.uid}/invoices`), invoiceDoc);
    
    // Generate PDF
    await generateInvoicePDF(invoiceData);
    
    toast({
      title: "Invoice Generated",
      description: `Invoice ${invoiceNumber} has been generated for ${selectedUser.name}.`,
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
    let filtered = inventory.filter((item) => {
      const matchesSearch = item.productName.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchesStatus = inventoryStatusFilter === "all" || item.status === inventoryStatusFilter;
      const matchesDate = matchesDateFilter(item.dateAdded, inventoryDateFilter);
      const matchesDatePicker = matchesDatePickerFilter(item.dateAdded, inventoryFromDate, inventoryToDate);
      return matchesSearch && matchesStatus && matchesDate && matchesDatePicker;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch (inventorySortBy) {
        case "name-asc":
          return a.productName.localeCompare(b.productName);
        case "name-desc":
          return b.productName.localeCompare(a.productName);
        case "date-asc":
          return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
        case "date-desc":
        default:
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      }
    });

    return filtered;
  }, [inventory, inventorySearch, inventoryStatusFilter, inventoryDateFilter, inventoryFromDate, inventoryToDate, inventorySortBy]);

  // Pagination for inventory
  const inventoryTotalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const inventoryStartIndex = (inventoryPage - 1) * itemsPerPage;
  const inventoryEndIndex = inventoryStartIndex + itemsPerPage;
  const paginatedInventory = filteredInventory.slice(inventoryStartIndex, inventoryEndIndex);
  const resetInventoryPagination = () => setInventoryPage(1);

  // Filtered shipped data
  const filteredShipped = useMemo(() => {
    const filtered = shipped.filter((item) => {
      const matchesSearch = item.productName.toLowerCase().includes(shippedSearch.toLowerCase());
      const matchesDate = matchesDateFilter(item.date, shippedDateFilter);
      return matchesSearch && matchesDate;
    });

    // Sort by date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = typeof a.date === 'string' ? new Date(a.date) : new Date(a.date.seconds * 1000);
      const dateB = typeof b.date === 'string' ? new Date(b.date) : new Date(b.date.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    });
  }, [shipped, shippedSearch, shippedDateFilter]);

  // Pagination for shipped
  const shippedTotalPages = Math.ceil(filteredShipped.length / itemsPerPage);
  const shippedStartIndex = (shippedPage - 1) * itemsPerPage;
  const shippedEndIndex = shippedStartIndex + itemsPerPage;
  const paginatedShipped = filteredShipped.slice(shippedStartIndex, shippedEndIndex);
  const resetShippedPagination = () => setShippedPage(1);

  // Filtered restock history data
  const filteredRestockHistory = useMemo(() => {
    const filtered = restockHistory.filter((item) => {
      const matchesDate = matchesDateFilter(item.restockedAt, restockDateFilter);
      return matchesDate;
    });
    
    // Sort by date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = typeof a.restockedAt === 'string' ? new Date(a.restockedAt) : new Date(a.restockedAt.seconds * 1000);
      const dateB = typeof b.restockedAt === 'string' ? new Date(b.restockedAt) : new Date(b.restockedAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    });
  }, [restockHistory, restockDateFilter]);

  // Pagination for restock history
  const restockHistoryTotalPages = Math.ceil(filteredRestockHistory.length / itemsPerPage);
  const restockHistoryStartIndex = (restockHistoryPage - 1) * itemsPerPage;
  const restockHistoryEndIndex = restockHistoryStartIndex + itemsPerPage;
  const paginatedRestockHistory = filteredRestockHistory.slice(restockHistoryStartIndex, restockHistoryEndIndex);
  const resetRestockHistoryPagination = () => setRestockHistoryPage(1);

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
    <TooltipProvider>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="sm:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={inventorySearch}
                  onChange={(e) => {
                    setInventorySearch(e.target.value);
                    resetInventoryPagination();
                  }}
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
              <Select value={inventoryStatusFilter} onValueChange={(value) => {
                setInventoryStatusFilter(value);
                resetInventoryPagination();
              }}>
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
              <Select value={inventoryDateFilter} onValueChange={(value) => {
                setInventoryDateFilter(value);
                resetInventoryPagination();
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
            <div className="sm:w-48">
              <DateRangePicker
                fromDate={inventoryFromDate}
                toDate={inventoryToDate}
                setFromDate={setInventoryFromDate}
                setToDate={setInventoryToDate}
                className="w-full"
              />
            </div>
            <div className="sm:w-48">
              <Select value={inventorySortBy} onValueChange={(value) => {
                setInventorySortBy(value);
                resetInventoryPagination();
              }}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Sort by Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Sort by Name (Z-A)</SelectItem>
                  <SelectItem value="date-asc">Sort by Date (Oldest)</SelectItem>
                  <SelectItem value="date-desc">Sort by Date (Newest)</SelectItem>
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
              {paginatedInventory.map((item) => (
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditProductWithLog(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit product details</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestockProduct(item)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Restock product</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRecycleProduct(item)}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Move to Recycle Bin</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteProduct(item)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Permanently delete product</p>
                      </TooltipContent>
                    </Tooltip>
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

          {/* Pagination Controls */}
          {filteredInventory.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {inventoryStartIndex + 1} to {Math.min(inventoryEndIndex, filteredInventory.length)} of {filteredInventory.length} items
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInventoryPage(p => Math.max(1, p - 1))}
                  disabled={inventoryPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {inventoryPage} of {inventoryTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInventoryPage(p => Math.min(inventoryTotalPages, p + 1))}
                  disabled={inventoryPage === inventoryTotalPages}
                >
                  Next
                </Button>
              </div>
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
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleGenerateInvoice}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Generate Invoice
                </Button>
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
                    onChange={(e) => {
                      setShippedSearch(e.target.value);
                      resetShippedPagination();
                    }}
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
                <Select value={shippedDateFilter} onValueChange={(value) => {
                  setShippedDateFilter(value);
                  resetShippedPagination();
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
            
            {filteredShipped.length > 0 ? (
              <div className="space-y-3">
                {paginatedShipped.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.productName}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Shipped: {item.shippedQty} units</span>
                        <span>Remaining: {item.remainingQty}</span>
                        <span>Pack: {item.packOf}</span>
                        <span>Ship To: {item.shipTo}</span>
                        <span>Date: {formatDate(item.date)}</span>
                      </div>
                      {item.remarks && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-left justify-start text-sm text-muted-foreground mt-1"
                          onClick={() => handleRemarksClick(item.remarks || "")}
                        >
                          <span>Remarks: {item.remarks}</span>
                          <Eye className="h-3 w-3 ml-1 flex-shrink-0" />
                        </Button>
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

            {/* Pagination Controls for Shipped Orders */}
            {filteredShipped.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {shippedStartIndex + 1} to {Math.min(shippedEndIndex, filteredShipped.length)} of {filteredShipped.length} items
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShippedPage(p => Math.max(1, p - 1))}
                    disabled={shippedPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {shippedPage} of {shippedTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShippedPage(p => Math.min(shippedTotalPages, p + 1))}
                    disabled={shippedPage === shippedTotalPages}
                  >
                    Next
                  </Button>
                </div>
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
                <Select value={restockDateFilter} onValueChange={(value) => {
                  setRestockDateFilter(value);
                  resetRestockHistoryPagination();
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

            {/* Pagination Controls for Restock History */}
            {filteredRestockHistory.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {restockHistoryStartIndex + 1} to {Math.min(restockHistoryEndIndex, filteredRestockHistory.length)} of {filteredRestockHistory.length} records
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRestockHistoryPage(p => Math.max(1, p - 1))}
                    disabled={restockHistoryPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {restockHistoryPage} of {restockHistoryTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRestockHistoryPage(p => Math.min(restockHistoryTotalPages, p + 1))}
                    disabled={restockHistoryPage === restockHistoryTotalPages}
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
                <CardDescription>View and restore recycled items for {selectedUser.name}</CardDescription>
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
                    onChange={(e) => {
                      setRecycleSearch(e.target.value);
                      resetRecyclePagination();
                    }}
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
            <div className="space-y-6">
              {/* Recycled Inventory Items */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Recycled Inventory Items ({filteredRecycledInventory.length})</h3>
                {recycledInventoryLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
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
                              <Badge variant={item.status === "In Stock" ? "default" : "destructive"}>
                                {item.status}
                              </Badge>
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
                      {recycledInventory.length === 0 ? "No inventory items have been recycled yet." : "No recycled inventory items match your search or date filter."}
                    </p>
                  </div>
                )}

                {/* Pagination for Recycle Section */}
                {filteredRecycledInventory.length > itemsPerPage && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Showing {recycleStartIndex + 1} to {Math.min(recycleEndIndex, filteredRecycledInventory.length)} of {filteredRecycledInventory.length} records
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
                        Page {recyclePage} of {recycleTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRecyclePage(p => Math.min(recycleTotalPages, p + 1))}
                        disabled={recyclePage === recycleTotalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Logs Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-red-600">Delete Logs ({filteredDeleteLogs.length})</CardTitle>
              <CardDescription>View permanently deleted products for {selectedUser.name}</CardDescription>
            </div>
            <div className="sm:w-48">
              <Select value={deleteLogsDateFilter} onValueChange={(value) => {
                setDeleteLogsDateFilter(value);
                resetDeleteLogsPagination();
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
                  value={deleteLogsSearch}
                  onChange={(e) => {
                    setDeleteLogsSearch(e.target.value);
                    resetDeleteLogsPagination();
                  }}
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
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredDeleteLogs.length > 0 ? (
            <div className="space-y-3">
              {paginatedDeleteLogs.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-800">{item.productName}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>Qty: {item.quantity}</span>
                        <span>Added: {formatDate(item.dateAdded)}</span>
                        <span className="text-red-600">Deleted: {formatDate(item.deletedAt)}</span>
                        <span>By: {item.deletedBy}</span>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Reason: </span>
                        <span className="text-red-700 font-medium">{item.reason}</span>
                      </div>
                      <div className="mt-2">
                        <Badge variant={item.status === "In Stock" ? "default" : "destructive"}>
                          {item.status}
                        </Badge>
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
                {deleteLogs.length === 0 ? "No products have been permanently deleted yet." : "No deleted products match your search or date filter."}
              </p>
            </div>
          )}

          {/* Pagination Controls for Delete Logs */}
          {filteredDeleteLogs.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {deleteLogsStartIndex + 1} to {Math.min(deleteLogsEndIndex, filteredDeleteLogs.length)} of {filteredDeleteLogs.length} records
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
                  Page {deleteLogsPage} of {deleteLogsTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteLogsPage(p => Math.min(deleteLogsTotalPages, p + 1))}
                  disabled={deleteLogsPage === deleteLogsTotalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Logs Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-blue-600">Edit Logs ({filteredEditLogs.length})</CardTitle>
              <CardDescription>View product edit history for {selectedUser.name}</CardDescription>
            </div>
            <div className="sm:w-48">
              <Select value={editLogsDateFilter} onValueChange={(value) => {
                setEditLogsDateFilter(value);
                resetEditLogsPagination();
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
                  value={editLogsSearch}
                  onChange={(e) => {
                    setEditLogsSearch(e.target.value);
                    resetEditLogsPagination();
                  }}
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
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredEditLogs.length > 0 ? (
            <div className="space-y-3">
              {paginatedEditLogs.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-800">{item.productName}</h4>
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
                        <Badge variant={item.newStatus === "In Stock" ? "default" : "destructive"}>
                          {item.newStatus}
                        </Badge>
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
                {editLogs.length === 0 ? "No products have been edited yet." : "No product edits match your search or date filter."}
              </p>
            </div>
          )}

          {/* Pagination Controls for Edit Logs */}
          {filteredEditLogs.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {editLogsStartIndex + 1} to {Math.min(editLogsEndIndex, filteredEditLogs.length)} of {filteredEditLogs.length} records
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
                  Page {editLogsPage} of {editLogsTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditLogsPage(p => Math.min(editLogsTotalPages, p + 1))}
                  disabled={editLogsPage === editLogsTotalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              <FormField
                control={restockForm.control}
                name="restockDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Restock Date</FormLabel>
                    <DatePicker date={field.value} setDate={field.onChange} />
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

      {/* Recycle Product Dialog */}
      <Dialog open={!!recyclingProduct} onOpenChange={() => setRecyclingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recycle Product</DialogTitle>
            <DialogDescription>Move inventory to recycle bin for "{recyclingProduct?.productName}"</DialogDescription>
          </DialogHeader>
          <Form {...recycleForm}>
            <form onSubmit={recycleForm.handleSubmit(onRecycleSubmit)} className="space-y-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Current Quantity:</strong> {recyclingProduct?.quantity}
                </p>
                <p className="text-sm">
                  <strong>Product:</strong> {recyclingProduct?.productName}
                </p>
              </div>
              <FormField
                control={recycleForm.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity to Recycle</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter quantity to recycle" 
                        min="1"
                        max={recyclingProduct?.quantity || 1}
                        value={field.value || 1}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Maximum: {recyclingProduct?.quantity} units
                    </p>
                  </FormItem>
                )}
              />
              <FormField
                control={recycleForm.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Recycling</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter reason for recycling (optional)" 
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Optional: Explain why this item is being recycled
                    </p>
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium"
                  disabled={false}
                  onClick={() => console.log("Done button clicked!")}
                >
                  Done
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setRecyclingProduct(null)}
                  className="px-6"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Product Dialog */}
      <Dialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>Permanently delete "{deletingProduct?.productName}" from inventory</DialogDescription>
          </DialogHeader>
          <Form {...deleteForm}>
            <form onSubmit={deleteForm.handleSubmit(onDeleteSubmit)} className="space-y-4">
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>⚠️ Warning:</strong> This action will permanently delete the product from inventory.
                </p>
                <div className="mt-2 text-sm">
                  <p><strong>Product:</strong> {deletingProduct?.productName}</p>
                  <p><strong>Quantity:</strong> {deletingProduct?.quantity} units</p>
                  <p><strong>Status:</strong> {deletingProduct?.status}</p>
                </div>
              </div>
              <FormField
                control={deleteForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Deletion *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter reason for deleting this product" 
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Required: Explain why this product is being deleted
                    </p>
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  Delete Product
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDeletingProduct(null)}
                  className="px-6"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Product with Log Dialog */}
      <Dialog open={!!editingProductWithLog} onOpenChange={() => setEditingProductWithLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product with Log</DialogTitle>
            <DialogDescription>Update product details and provide reason for changes</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Product Info Display */}
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>📝 Editing:</strong> {editingProductWithLog?.productName}
              </p>
              <div className="mt-2 text-sm">
                <p><strong>Current Quantity:</strong> {editingProductWithLog?.quantity} units</p>
                <p><strong>Current Status:</strong> {editingProductWithLog?.status}</p>
                <p><strong>Date Added:</strong> {formatDate(editingProductWithLog?.dateAdded)}</p>
              </div>
            </div>

            {/* Edit Form */}
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit((editValues) => {
                // Handle edit form submission
                editLogForm.handleSubmit(onEditWithLogSubmit)();
              })} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
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
                </div>

                {/* Reason for Edit */}
                <FormField
                  control={editLogForm.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for Edit *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter reason for editing this product" 
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">
                        Required: Explain why this product is being edited
                      </p>
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button 
                    type="submit" 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    Update Product
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingProductWithLog(null)}
                    className="px-6"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
    </TooltipProvider>
  );
}
