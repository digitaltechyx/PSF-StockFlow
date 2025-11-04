"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Download, CheckCircle, Clock, X, Eye, DollarSign, Receipt, Upload, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { generateInvoicePDF } from "@/lib/invoice-generator";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { validatePDFFile, compressPDF } from "@/lib/pdf-compression";
import type { Invoice } from "@/types";

interface InvoicesSectionProps {
  invoices: Invoice[];
  loading: boolean;
}

export function InvoicesSection({ invoices, loading }: InvoicesSectionProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFileInputRef, setUploadFileInputRef] = useState<HTMLInputElement | null>(null);
  const itemsPerPage = 10;

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  
  // Enhanced filtering with search, status, date range, and preset filters
  const filteredInvoices = invoices.filter(inv => {
    // Search filter
    const matchesSearch = searchTerm === "" || 
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.soldTo.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    
    // Date range filter
    let matchesDateRange = true;
    if (startDate || endDate) {
      const invoiceDate = new Date(inv.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start && end) {
        matchesDateRange = invoiceDate >= start && invoiceDate <= end;
      } else if (start) {
        matchesDateRange = invoiceDate >= start;
      } else if (end) {
        matchesDateRange = invoiceDate <= end;
      }
    }
    
    // Preset date filter
    let matchesPresetDate = true;
    if (dateFilter !== "all") {
      const invoiceDate = typeof inv.createdAt === 'string' 
        ? new Date(inv.createdAt) 
        : new Date(inv.createdAt.seconds * 1000);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case "today":
          matchesPresetDate = daysDiff === 0;
          break;
        case "week":
          matchesPresetDate = daysDiff <= 7;
          break;
        case "month":
          matchesPresetDate = daysDiff <= 30;
          break;
        case "year":
          matchesPresetDate = daysDiff <= 365;
          break;
        default:
          matchesPresetDate = true;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDateRange && matchesPresetDate;
  });

  const filteredPendingInvoices = filteredInvoices.filter(inv => inv.status === 'pending');
  const filteredPaidInvoices = filteredInvoices.filter(inv => inv.status === 'paid');
  
  // Pagination calculations
  const totalPendingPages = Math.ceil(filteredPendingInvoices.length / itemsPerPage);
  const totalPaidPages = Math.ceil(filteredPaidInvoices.length / itemsPerPage);
  const startPendingIndex = (pendingPage - 1) * itemsPerPage;
  const endPendingIndex = startPendingIndex + itemsPerPage;
  const startPaidIndex = (paidPage - 1) * itemsPerPage;
  const endPaidIndex = startPaidIndex + itemsPerPage;

  const pendingPaginated = filteredPendingInvoices
    .sort((a, b) => {
      const dateA = typeof a.createdAt === 'string' ? new Date(a.createdAt) : new Date(a.createdAt.seconds * 1000);
      const dateB = typeof b.createdAt === 'string' ? new Date(b.createdAt) : new Date(b.createdAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startPendingIndex, endPendingIndex);

  const paidPaginated = filteredPaidInvoices
    .sort((a, b) => {
      const dateA = typeof a.createdAt === 'string' ? new Date(a.createdAt) : new Date(a.createdAt.seconds * 1000);
      const dateB = typeof b.createdAt === 'string' ? new Date(b.createdAt) : new Date(b.createdAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startPaidIndex, endPaidIndex);

  // Reset pagination when filters change
  const resetPagination = () => {
    setPendingPage(1);
    setPaidPage(1);
  };
  
  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      await generateInvoicePDF({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        orderNumber: invoice.orderNumber,
        soldTo: invoice.soldTo,
        fbm: invoice.fbm,
        items: invoice.items,
      });
      
      toast({
        title: "Invoice Downloaded",
        description: `${invoice.invoiceNumber} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download invoice.",
      });
    }
  };

  const handleMarkAsPaid = async (invoiceId: string, invoice: Invoice) => {
    try {
      // Update invoice in user's invoices collection
      await updateDoc(doc(db, `users/${invoice.userId}/invoices/${invoiceId}`), {
        status: 'paid',
      });
      
      toast({
        title: "Invoice Marked as Paid",
        description: "Invoice status has been updated.",
      });
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update invoice status.",
      });
    }
  };

  const handleUploadPDF = async (invoice: Invoice, file: File) => {
    if (!user || !user.uid) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please log in to upload PDFs.",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Validate PDF file
      const validation = validatePDFFile(file);
      if (!validation.valid) {
        toast({
          variant: "destructive",
          title: "Invalid File",
          description: validation.error || "Please upload a valid PDF file.",
        });
        setIsUploading(false);
        return;
      }

      // Compress PDF if needed
      const compressionResult = await compressPDF(file);
      if (!compressionResult.success) {
        toast({
          variant: "destructive",
          title: "File Too Large",
          description: compressionResult.error || "File size exceeds 1MB limit.",
        });
        setIsUploading(false);
        return;
      }

      const fileToUpload = compressionResult.file || file;

      // Prepare form data
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('invoiceNumber', invoice.invoiceNumber);
      formData.append('userId', user.uid);

      // Upload to Google Drive via API
      const response = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload PDF');
      }

      // Save metadata to Firestore
      const pdfMetadata = {
        fileId: result.fileId,
        fileName: result.fileName,
        webViewLink: result.webViewLink,
        size: parseInt(result.size || '0'),
        uploadedAt: serverTimestamp(),
        uploadedBy: user.uid,
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id,
      };

      // Add to uploadedPDFs collection
      const pdfDocRef = await addDoc(collection(db, 'uploadedPDFs'), pdfMetadata);

      // Update invoice with PDF reference
      await updateDoc(doc(db, `users/${invoice.userId}/invoices/${invoice.id}`), {
        uploadedPdf: {
          id: pdfDocRef.id,
          ...pdfMetadata,
          uploadedAt: new Date(),
        },
      });

      toast({
        title: "PDF Uploaded Successfully",
        description: "Your PDF has been uploaded to Google Drive.",
      });

      // Reset file input
      if (uploadFileInputRef) {
        uploadFileInputRef.value = '';
      }

      // Refresh invoice data
      if (selectedInvoice && selectedInvoice.id === invoice.id) {
        setSelectedInvoice({
          ...selectedInvoice,
          uploadedPdf: {
            id: pdfDocRef.id,
            ...pdfMetadata,
            uploadedAt: new Date(),
          },
        });
      }

    } catch (error) {
      console.error("Error uploading PDF:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload PDF. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, invoice: Invoice) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUploadPDF(invoice, file);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date === 'string') return format(new Date(date), "MMM dd, yyyy");
    return format(new Date(date.seconds * 1000), "MMM dd, yyyy");
  };

  return (
    <div className="space-y-6">
      {/* Professional Search and Filter Bar */}
      {invoices.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* First Row: Search, Status, Date Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number or customer name..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    resetPagination();
                  }}
                  className="pl-10"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => {
                      setSearchTerm("");
                      resetPagination();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              {/* Status Filter */}
              <div className="sm:w-48">
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value);
                  resetPagination();
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date Filter */}
              <div className="sm:w-48">
                <Select value={dateFilter} onValueChange={(value) => {
                  setDateFilter(value);
                  resetPagination();
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
            
            {/* Second Row: Date Range Filter */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">From Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      resetPagination();
                    }}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">To Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      resetPagination();
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              {(startDate || endDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    resetPagination();
                  }}
                  className="mt-3 w-full sm:w-auto"
                >
                  Clear Date Range Filter
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            Pending Invoices ({filteredPendingInvoices.length})
          </CardTitle>
          <CardDescription>Invoices waiting for payment</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredPendingInvoices.length > 0 ? (
            <div className="space-y-3">
              {pendingPaginated.map((invoice) => (
                  <div key={invoice.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg bg-yellow-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{invoice.invoiceNumber}</h3>
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">Pending</Badge>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1">
                        <p>Date: {invoice.date}</p>
                        <p className="font-semibold text-sm sm:text-lg">Total: ${invoice.grandTotal.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:flex-row sm:flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleViewInvoice(invoice)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleDownloadInvoice(invoice)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending invoices</h3>
              <p className="text-muted-foreground">
                {pendingInvoices.length === 0 ? "You don't have any pending invoices." : "No pending invoices match your search."}
              </p>
            </div>
          )}
          
          {/* Pagination for Pending Invoices */}
          {filteredPendingInvoices.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startPendingIndex + 1} to {Math.min(endPendingIndex, filteredPendingInvoices.length)} of {filteredPendingInvoices.length} invoices
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                  disabled={pendingPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {pendingPage} of {totalPendingPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingPage(p => Math.min(totalPendingPages, p + 1))}
                  disabled={pendingPage === totalPendingPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paid Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Paid Invoices ({filteredPaidInvoices.length})
          </CardTitle>
          <CardDescription>Invoices that have been paid</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredPaidInvoices.length > 0 ? (
            <div className="space-y-3">
              {paidPaginated.map((invoice) => (
                  <div key={invoice.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg bg-green-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{invoice.invoiceNumber}</h3>
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[10px] sm:text-xs">Paid</Badge>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1">
                        <p>Date: {invoice.date}</p>
                        <p className="font-semibold text-sm sm:text-lg">Total: ${invoice.grandTotal.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:flex-row sm:flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleViewInvoice(invoice)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleDownloadInvoice(invoice)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No paid invoices</h3>
              <p className="text-muted-foreground">
                {paidInvoices.length === 0 ? "You don't have any paid invoices yet." : "No paid invoices match your search."}
              </p>
            </div>
          )}
          
          {/* Pagination for Paid Invoices */}
          {filteredPaidInvoices.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startPaidIndex + 1} to {Math.min(endPaidIndex, filteredPaidInvoices.length)} of {filteredPaidInvoices.length} invoices
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaidPage(p => Math.max(1, p - 1))}
                  disabled={paidPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {paidPage} of {totalPaidPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaidPage(p => Math.min(totalPaidPages, p + 1))}
                  disabled={paidPage === totalPaidPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
              Invoice Details
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              View complete invoice information
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4 sm:space-y-6 mt-2 sm:mt-4">
              {/* Invoice Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-semibold text-sm sm:text-base break-all">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold text-sm sm:text-base">{selectedInvoice.date}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
                  <Badge variant={selectedInvoice.status === 'paid' ? 'default' : 'secondary'} className="text-xs sm:text-sm mt-1">
                    {selectedInvoice.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Sold To and FBM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">Sold To</h4>
                  <p className="text-xs sm:text-sm">{selectedInvoice.soldTo.name}</p>
                  {selectedInvoice.soldTo.address && <p className="text-xs sm:text-sm text-muted-foreground break-words">{selectedInvoice.soldTo.address}</p>}
                  {selectedInvoice.soldTo.phone && <p className="text-xs sm:text-sm text-muted-foreground">{selectedInvoice.soldTo.phone}</p>}
                  <p className="text-xs sm:text-sm text-muted-foreground break-all">{selectedInvoice.soldTo.email}</p>
                </div>
                <div className="p-3 sm:p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">FBM</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">{selectedInvoice.fbm}</p>
                </div>
              </div>

              {/* Items Table - Desktop */}
              <div className="hidden sm:block border rounded-lg overflow-hidden">
                <div className="bg-muted p-2 grid grid-cols-8 gap-2 text-sm font-semibold">
                  <div>Qty</div>
                  <div className="col-span-2">Product</div>
                  <div>Ship Date</div>
                  <div>Ship To</div>
                  <div>Packaging</div>
                  <div>Unit Price</div>
                  <div>Amount</div>
                </div>
                {selectedInvoice.items.map((item, idx) => (
                  <div key={`${item.productName}-${idx}`} className="p-2 grid grid-cols-8 gap-2 text-sm border-t">
                    <div>{item.quantity}</div>
                    <div className="col-span-2">{item.productName}</div>
                    <div>{item.shipDate || '-'}</div>
                    <div className="truncate" title={item.shipTo}>{item.shipTo}</div>
                    <div>{item.packaging}</div>
                    <div>${item.unitPrice.toFixed(2)}</div>
                    <div className="font-semibold">${item.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {/* Items Cards - Mobile */}
              <div className="sm:hidden space-y-3">
                <h4 className="font-semibold text-sm mb-2">Items</h4>
                {selectedInvoice.items.map((item, idx) => (
                  <div key={`${item.productName}-${idx}`} className="border rounded-lg p-3 bg-muted/30 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-semibold text-sm">${item.amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">${item.unitPrice.toFixed(2)} each</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                      <div>
                        <p className="text-muted-foreground">Ship Date</p>
                        <p className="font-medium">{item.shipDate || '-'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Packaging</p>
                        <p className="font-medium">{item.packaging}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Ship To</p>
                        <p className="font-medium break-words">{item.shipTo}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full sm:w-64 space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                    <span>NJ Sales Tax 6.625% - Excluded</span>
                    <span>-</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-bold text-base sm:text-lg">
                    <span>Grand Total:</span>
                    <span>${selectedInvoice.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 sm:pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
                  onClick={() => selectedInvoice && handleDownloadInvoice(selectedInvoice)}
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Download PDF
                </Button>
                {/* PDF upload/view buttons moved to PDF section */}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

