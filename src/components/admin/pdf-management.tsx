"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Download, FileText, X, Eye, ExternalLink, Printer } from "lucide-react";
import { format } from "date-fns";
import type { UploadedPDF } from "@/types";
// Google Drive integration - no Firebase Storage imports needed

interface PDFManagementProps {
  pdfs: UploadedPDF[];
  loading: boolean;
}

export function PDFManagement({ pdfs, loading }: PDFManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPDF, setSelectedPDF] = useState<UploadedPDF | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const itemsPerPage = 10;

  // Get unique client names for filter
  const clientNames = useMemo(() => {
    const names = new Set(pdfs.map((pdf) => pdf.uploadedByName).filter(Boolean));
    return Array.from(names).sort();
  }, [pdfs]);

  // Filter PDFs
  const filteredPDFs = useMemo(() => {
    return pdfs.filter((pdf) => {
      // Search filter
      const matchesSearch =
        searchTerm === "" ||
        pdf.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pdf.uploadedByName.toLowerCase().includes(searchTerm.toLowerCase());

      // Client filter
      const matchesClient = clientFilter === "all" || pdf.uploadedByName === clientFilter;

      // Date filter
      let matchesDate = true;
      if (dateFilter !== "all") {
        if (!pdf.uploadedAt) {
          matchesDate = false;
        } else {
          const pdfDate =
            typeof pdf.uploadedAt === "string"
              ? new Date(pdf.uploadedAt)
              : pdf.uploadedAt.seconds
              ? new Date(pdf.uploadedAt.seconds * 1000)
              : null;

          if (!pdfDate) {
            matchesDate = false;
          } else {
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
            }
          }
        }
      }

      return matchesSearch && matchesClient && matchesDate;
    });
  }, [pdfs, searchTerm, dateFilter, clientFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredPDFs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedPDFs = filteredPDFs
    .sort((a, b) => {
      // Handle null/undefined uploadedAt
      if (!a.uploadedAt) return 1;
      if (!b.uploadedAt) return -1;

      const dateA =
        typeof a.uploadedAt === "string"
          ? new Date(a.uploadedAt)
          : a.uploadedAt.seconds
          ? new Date(a.uploadedAt.seconds * 1000)
          : new Date(0);
      const dateB =
        typeof b.uploadedAt === "string"
          ? new Date(b.uploadedAt)
          : b.uploadedAt.seconds
          ? new Date(b.uploadedAt.seconds * 1000)
          : new Date(0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(startIndex, endIndex);

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date === "string") return format(new Date(date), "MMM dd, yyyy");
    if (date.seconds) return format(new Date(date.seconds * 1000), "MMM dd, yyyy");
    return "N/A";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleView = (pdf: UploadedPDF) => {
    setSelectedPDF(pdf);
    setIsViewDialogOpen(true);
  };

  const handleDownload = async (pdf: UploadedPDF) => {
    try {
      console.log("Download button clicked for:", pdf.fileName);
      
      // Use Google Drive download URL
      if (pdf.downloadURL) {
        // Get download URL from Google Drive API if needed
        const response = await fetch(`/api/drive/download?filePath=${encodeURIComponent(pdf.storagePath)}`);
        if (response.ok) {
          const data = await response.json();
          const downloadUrl = data.downloadUrl || pdf.downloadURL;
          
          // Fetch the file
          const fileResponse = await fetch(downloadUrl);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            const blobURL = URL.createObjectURL(blob);
            
            // Create a download link
            const link = document.createElement("a");
            link.href = blobURL;
            link.download = pdf.fileName;
            link.style.position = "fixed";
            link.style.top = "-9999px";
            link.style.left = "-9999px";
            
            // Append to body
            document.body.appendChild(link);
            
            // Force a click event
            const clickEvent = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            });
            
            link.dispatchEvent(clickEvent);
            
            // Cleanup after a delay
            setTimeout(() => {
              if (document.body.contains(link)) {
                document.body.removeChild(link);
              }
              URL.revokeObjectURL(blobURL);
            }, 200);
          }
        } else {
          // Fallback: use direct download URL
          window.open(pdf.downloadURL, '_blank');
        }
      } else {
        // Fallback: try using the download URL directly
        window.open(pdf.downloadURL, '_blank');
      }
    } catch (error) {
      console.error("Download error:", error);
      // Final fallback: open in new tab
      if (pdf.downloadURL) {
        window.open(pdf.downloadURL, '_blank');
      }
    }
  };

  const handleViewInNewTab = (pdf: UploadedPDF) => {
    // Open PDF in new tab with proper title and icon
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      // Create a data URL for a simple PDF icon (SVG)
      const pdfIconSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      `;
      const pdfIconDataURL = `data:image/svg+xml,${encodeURIComponent(pdfIconSVG)}`;
      
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${pdf.fileName}</title>
            <link rel="icon" type="image/svg+xml" href="${pdfIconDataURL}">
            <style>
              body {
                margin: 0;
                padding: 0;
                overflow: hidden;
              }
              iframe {
                width: 100%;
                height: 100vh;
                border: none;
              }
            </style>
          </head>
          <body>
            <iframe src="${pdf.downloadURL}" title="${pdf.fileName}"></iframe>
          </body>
        </html>
      `);
      newWindow.document.close();
    } else {
      // Fallback: direct open
      window.open(pdf.downloadURL, "_blank");
    }
  };

  const handlePrint = (pdf: UploadedPDF) => {
    // Open PDF directly in a new window
    const printWindow = window.open(pdf.downloadURL, "_blank");
    
    if (!printWindow) {
      // If popup blocked, fallback to opening in current window
      window.open(pdf.downloadURL, "_blank");
      return;
    }
    
    // Wait for the PDF to load, then trigger print dialog
    // Try multiple times with delays to catch the PDF when it's ready
    let attempts = 0;
    const maxAttempts = 25; // Try for up to 5 seconds (25 * 200ms)
    
    const tryPrint = setInterval(() => {
      attempts++;
      
      try {
        // Check if window is still open
        if (printWindow.closed) {
          clearInterval(tryPrint);
          return;
        }
        
        // Try to trigger print dialog
        printWindow.focus();
        printWindow.print();
        
        // If we got here without error, print was triggered
        // Clear interval after a short delay to ensure print dialog opens
        setTimeout(() => {
          clearInterval(tryPrint);
        }, 100);
      } catch (error) {
        // If we've tried enough times, stop trying
        if (attempts >= maxAttempts) {
          clearInterval(tryPrint);
          // Fallback: user can manually print using Ctrl+P
          printWindow.focus();
          console.log("Print dialog could not be triggered automatically. Please press Ctrl+P to print.");
        }
      }
    }, 200); // Try every 200ms
    
    // Cleanup interval after 6 seconds
    setTimeout(() => {
      clearInterval(tryPrint);
    }, 6000);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-purple-600">Labels Management ({filteredPDFs.length} total)</CardTitle>
              <CardDescription>View and manage all uploaded labels from all users</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by filename or client..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 w-full sm:w-64"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Select
                value={clientFilter}
                onValueChange={(value) => {
                  setClientFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clientNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={dateFilter}
                onValueChange={(value) => {
                  setDateFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
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
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : paginatedPDFs.length > 0 ? (
            <div className="space-y-3">
              {paginatedPDFs.map((pdf) => (
                <div key={pdf.id}>
                  {/* Mobile: compact layout */}
                  <div className="block sm:hidden p-3 border rounded-lg bg-purple-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-purple-800 truncate">{pdf.fileName}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pdf.uploadedByName} • {formatDate(pdf.uploadedAt)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pdf.year}/{pdf.month}/{pdf.date}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-purple-100 text-purple-800">
                        {formatFileSize(pdf.size)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-6 px-2"
                        onClick={() => handleView(pdf)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-6 px-2"
                        onClick={() => handlePrint(pdf)}
                      >
                        <Printer className="h-3 w-3 mr-1" />
                        Print
                      </Button>
                    </div>
                  </div>
                  {/* Desktop/Tablet: full layout */}
                  <div className="hidden sm:block">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-purple-800 truncate">{pdf.fileName}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="truncate">Client: {pdf.uploadedByName}</span>
                          <span>Uploaded: {formatDate(pdf.uploadedAt)}</span>
                          <span>Path: {pdf.year}/{pdf.month}/{pdf.uploadedByName}/{pdf.date}</span>
                          <Badge variant="secondary" className="text-xs">
                            {formatFileSize(pdf.size)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => handleView(pdf)}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => handlePrint(pdf)}
                        >
                          <Printer className="h-4 w-4" />
                          Print
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold">No PDFs found</p>
              <p className="text-sm mt-2">
                {pdfs.length === 0
                  ? "No PDFs have been uploaded yet."
                  : "No PDFs match your search or filter criteria."}
              </p>
            </div>
          )}

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
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View PDF Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPDF?.fileName}</DialogTitle>
            <DialogDescription>
              View PDF uploaded by {selectedPDF?.uploadedByName} on {formatDate(selectedPDF?.uploadedAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedPDF && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">File Name:</span>
                  <p className="text-muted-foreground">{selectedPDF.fileName}</p>
                </div>
                <div>
                  <span className="font-semibold">Client:</span>
                  <p className="text-muted-foreground">{selectedPDF.uploadedByName}</p>
                </div>
                <div>
                  <span className="font-semibold">File Size:</span>
                  <p className="text-muted-foreground">{formatFileSize(selectedPDF.size)}</p>
                </div>
                <div>
                  <span className="font-semibold">Upload Date:</span>
                  <p className="text-muted-foreground">{formatDate(selectedPDF.uploadedAt)}</p>
                </div>
                <div>
                  <span className="font-semibold">Storage Path:</span>
                  <p className="text-muted-foreground break-all">{selectedPDF.storagePath}</p>
                </div>
                <div>
                  <span className="font-semibold">Folder:</span>
                  <p className="text-muted-foreground">
                    {selectedPDF.year}/{selectedPDF.month}/{selectedPDF.date}
                  </p>
                </div>
              </div>

              {/* PDF Viewer */}
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={selectedPDF.downloadURL}
                  className="w-full h-[600px]"
                  title={selectedPDF.fileName}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleViewInNewTab(selectedPDF)} className="flex-1">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button onClick={() => handlePrint(selectedPDF)} variant="outline" className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

