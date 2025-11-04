"use client";

import { useState, useMemo } from "react";
import { useCollection } from "@/hooks/use-collection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye, FileText, ExternalLink, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import type { UploadedPDF } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface PDFManagementProps {
  className?: string;
}

export function PDFManagement({ className }: PDFManagementProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedPDF, setSelectedPDF] = useState<UploadedPDF | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch uploaded PDFs
  const { data: uploadedPDFs, loading } = useCollection<UploadedPDF>("uploadedPDFs");

  // Filter PDFs
  const filteredPDFs = useMemo(() => {
    if (!uploadedPDFs) return [];

    return uploadedPDFs.filter((pdf) => {
      // Search filter
      const matchesSearch =
        searchTerm === "" ||
        pdf.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pdf.fileName.toLowerCase().includes(searchTerm.toLowerCase());

      // Date filter
      let matchesDate = true;
      if (dateFilter !== "all") {
        const pdfDate =
          typeof pdf.uploadedAt === "string"
            ? new Date(pdf.uploadedAt)
            : new Date(pdf.uploadedAt.seconds * 1000);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - pdfDate.getTime()) / (1000 * 60 * 60 * 24));

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
          default:
            matchesDate = true;
        }
      }

      return matchesSearch && matchesDate;
    }).sort((a, b) => {
      // Sort by upload date (newest first)
      // Handle null/undefined uploadedAt
      if (!a.uploadedAt) return 1; // Put null dates at the end
      if (!b.uploadedAt) return -1;
      
      const dateA = typeof a.uploadedAt === "string" 
        ? new Date(a.uploadedAt) 
        : a.uploadedAt.seconds 
          ? new Date(a.uploadedAt.seconds * 1000)
          : new Date(0);
      const dateB = typeof b.uploadedAt === "string" 
        ? new Date(b.uploadedAt) 
        : b.uploadedAt.seconds 
          ? new Date(b.uploadedAt.seconds * 1000)
          : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [uploadedPDFs, searchTerm, dateFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredPDFs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPDFs = filteredPDFs.slice(startIndex, endIndex);

  // Reset pagination when filters change
  const resetPagination = () => {
    setCurrentPage(1);
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date === "string") return format(new Date(date), "MMM dd, yyyy HH:mm");
    if (date.seconds) return format(new Date(date.seconds * 1000), "MMM dd, yyyy HH:mm");
    return "N/A";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleViewPDF = (pdf: UploadedPDF) => {
    setSelectedPDF(pdf);
    setIsViewDialogOpen(true);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Uploaded PDFs</CardTitle>
          <CardDescription>View and manage uploaded invoice PDFs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Uploaded PDFs</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            View and manage PDFs uploaded to Google Drive ({filteredPDFs.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number or file name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  resetPagination();
                }}
                className="pl-10 text-sm sm:text-base"
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
            <div className="sm:w-48">
              <Select value={dateFilter} onValueChange={(value) => {
                setDateFilter(value);
                resetPagination();
              }}>
                <SelectTrigger className="text-sm sm:text-base">
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

          {/* PDF List - Desktop */}
          <div className="hidden sm:block">
            {filteredPDFs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No PDFs found</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 grid grid-cols-12 gap-4 text-sm font-semibold">
                  <div className="col-span-3">Invoice Number</div>
                  <div className="col-span-3">File Name</div>
                  <div className="col-span-2">Uploaded At</div>
                  <div className="col-span-2">Size</div>
                  <div className="col-span-2">Actions</div>
                </div>
                {paginatedPDFs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="p-3 grid grid-cols-12 gap-4 text-sm border-t hover:bg-muted/50 transition-colors"
                  >
                    <div className="col-span-3 font-medium">{pdf.invoiceNumber}</div>
                    <div className="col-span-3 truncate" title={pdf.fileName}>
                      {pdf.fileName}
                    </div>
                    <div className="col-span-2 text-muted-foreground">{formatDate(pdf.uploadedAt)}</div>
                    <div className="col-span-2 text-muted-foreground">{formatFileSize(pdf.size)}</div>
                    <div className="col-span-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPDF(pdf)}
                        className="flex-1"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(pdf.webViewLink, "_blank")}
                        className="flex-1"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PDF List - Mobile */}
          <div className="sm:hidden space-y-3">
            {filteredPDFs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No PDFs found</p>
              </div>
            ) : (
              paginatedPDFs.map((pdf) => (
                <Card key={pdf.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">
                          {pdf.invoiceNumber}
                        </CardTitle>
                        <CardDescription className="text-xs truncate mt-1">
                          {pdf.fileName}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {formatFileSize(pdf.size)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span className="truncate">{formatDate(pdf.uploadedAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPDF(pdf)}
                        className="flex-1 text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(pdf.webViewLink, "_blank")}
                        className="flex-1 text-xs"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {filteredPDFs.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredPDFs.length)} of {filteredPDFs.length} records
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
      </Card>

      {/* PDF Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2 sm:pb-4">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              PDF Details
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              View complete PDF information
            </DialogDescription>
          </DialogHeader>

          {selectedPDF && (
            <div className="space-y-4 sm:space-y-6 mt-2 sm:mt-4">
              {/* PDF Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-semibold text-sm sm:text-base">{selectedPDF.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">File Name</p>
                  <p className="font-semibold text-sm sm:text-base break-all">{selectedPDF.fileName}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">File Size</p>
                  <p className="font-semibold text-sm sm:text-base">{formatFileSize(selectedPDF.size)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Uploaded At</p>
                  <p className="font-semibold text-sm sm:text-base">{formatDate(selectedPDF.uploadedAt)}</p>
                </div>
              </div>

              {/* Google Drive Info */}
              <div className="p-3 sm:p-4 border rounded-lg">
                <h4 className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">Google Drive</h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div>
                    <p className="text-muted-foreground">File ID</p>
                    <p className="font-mono break-all">{selectedPDF.fileId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">View Link</p>
                    <a
                      href={selectedPDF.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {selectedPDF.webViewLink}
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-3 sm:pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
                  onClick={() => window.open(selectedPDF.webViewLink, "_blank")}
                >
                  <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Open in Google Drive
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

