"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, X, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import type { UploadedPDF } from "@/types";
// Google Drive integration - no Firebase Storage imports needed

interface PDFListProps {
  pdfs: UploadedPDF[];
  loading: boolean;
  currentUserId?: string;
}

export function PDFList({ pdfs, loading, currentUserId }: PDFListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPDF, setSelectedPDF] = useState<UploadedPDF | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewURL, setViewURL] = useState<string | null>(null);
  const [loadingViewURL, setLoadingViewURL] = useState(false);
  const itemsPerPage = 10;

  // Filter PDFs
  const filteredPDFs = useMemo(() => {
    return pdfs.filter((pdf) => {
      // Search filter
      const matchesSearch =
        searchTerm === "" ||
        pdf.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pdf.uploadedByName.toLowerCase().includes(searchTerm.toLowerCase());

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

      return matchesSearch && matchesDate;
    });
  }, [pdfs, searchTerm, dateFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredPDFs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const paginatedPDFs = filteredPDFs
    .sort((a, b) => {
      // Handle null/undefined uploadedAt
      if (!a.uploadedAt) return 1; // Put null dates at the end
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

  const handleView = async (pdf: UploadedPDF) => {
    setSelectedPDF(pdf);
    setIsViewDialogOpen(true);
    setViewURL(null);
    setLoadingViewURL(true);
    
    try {
      // Fetch viewable URL from API
      const response = await fetch(`/api/drive/download?filePath=${encodeURIComponent(pdf.storagePath)}`);
      if (response.ok) {
        const data = await response.json();
        setViewURL(data.viewURL || data.webUrl || pdf.downloadURL);
      } else {
        // Fallback to stored downloadURL if API fails
        setViewURL(pdf.downloadURL);
      }
    } catch (error) {
      console.error('Error fetching view URL:', error);
      // Fallback to stored downloadURL
      setViewURL(pdf.downloadURL);
    } finally {
      setLoadingViewURL(false);
    }
  };


  return (
    <Card className="w-full min-w-0">
      <CardHeader className="w-full min-w-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
          <div>
            <CardTitle className="text-purple-600">Uploaded Labels ({filteredPDFs.length})</CardTitle>
            <CardDescription>View and manage your uploaded label files</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename or client name..."
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
                {/* Mobile: compact with chips */}
                <div className="block sm:hidden p-3 border rounded-lg bg-purple-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-purple-800 truncate">{pdf.fileName}</h3>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {pdf.uploadedByName} • {pdf.year}/{pdf.month}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-purple-100 text-purple-800">
                      {formatFileSize(pdf.size)}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px] border-muted-foreground/20">
                      {formatDate(pdf.uploadedAt)}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-6 px-2"
                      onClick={() => handleView(pdf)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
                {/* Desktop/Tablet: original row layout */}
                <div className="hidden md:block">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-purple-800 truncate">{pdf.fileName}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="truncate">Client: {pdf.uploadedByName}</span>
                        <span>Uploaded: {formatDate(pdf.uploadedAt)}</span>
                        <span className="hidden lg:inline">Path: {pdf.year}/{pdf.month}/{pdf.uploadedByName}/{pdf.date}</span>
                        <Badge variant="secondary" className="text-xs">
                          {formatFileSize(pdf.size)}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 ml-4 flex-shrink-0"
                      onClick={() => handleView(pdf)}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
                {/* Tablet: medium layout */}
                <div className="hidden sm:block md:hidden">
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-purple-50">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-purple-800 truncate">{pdf.fileName}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="truncate">{pdf.uploadedByName}</span>
                        <span>•</span>
                        <span>{formatDate(pdf.uploadedAt)}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          {formatFileSize(pdf.size)}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 ml-3 flex-shrink-0 text-xs"
                      onClick={() => handleView(pdf)}
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold">No labels uploaded yet</p>
            <p className="text-sm mt-2">
              {pdfs.length === 0
                ? "Upload your first label using the upload button above."
                : "No labels match your search or filter criteria."}
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredPDFs.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredPDFs.length)} of {filteredPDFs.length} records
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </Button>
              <span className="text-xs sm:text-sm px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="text-xs sm:text-sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* View PDF Dialog */}
      <Dialog 
        open={isViewDialogOpen} 
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {
            setViewURL(null);
            setSelectedPDF(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg truncate">{selectedPDF?.fileName}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              View PDF uploaded by {selectedPDF?.uploadedByName} on {formatDate(selectedPDF?.uploadedAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedPDF && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                <div>
                  <span className="font-semibold">File Name:</span>
                  <p className="text-muted-foreground break-all">{selectedPDF.fileName}</p>
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
                <div className="sm:col-span-2">
                  <span className="font-semibold">Storage Path:</span>
                  <p className="text-muted-foreground break-all text-xs">{selectedPDF.storagePath}</p>
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
                {loadingViewURL ? (
                  <div className="w-full h-[400px] sm:h-[600px] flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Loading PDF viewer...</p>
                  </div>
                ) : viewURL ? (
                  <iframe
                    src={viewURL}
                    className="w-full h-[400px] sm:h-[600px]"
                    title={selectedPDF.fileName}
                  />
                ) : (
                  <div className="w-full h-[400px] sm:h-[600px] flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Unable to load PDF viewer</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

