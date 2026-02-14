"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { FileText, Upload, Loader2, CheckCircle, Clock, Download, User, Search, FileStack, CalendarCheck } from "lucide-react";
import { format, subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollectionGroup } from "@/hooks/use-collection";

interface DocumentRequest {
  id: string;
  userId: string;
  documentType: string;
  status: "pending" | "complete";
  requestedAt: any;
  completedAt?: any;
  documentUrl?: string;
  fileName?: string;
  notes?: string;
  companyName?: string;
  contact?: string;
  email?: string;
  userEmail?: string;
  userName?: string;
}

export default function DocumentRequestsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Get all document requests using collectionGroup
  const { data: allRequests, loading } = useCollectionGroup<DocumentRequest>(
    "documentRequests"
  );

  // Get user data for each request
  const { data: users } = useCollection<any>("users");
  const requestsWithUserData = allRequests.map((request) => {
    const user = users.find((u: any) => u.uid === request.userId);
    return {
      ...request,
      userName: user?.name || "Unknown User",
      userEmail: user?.email || "Unknown Email",
    };
  });

  const pendingRequests = requestsWithUserData.filter((req) => req.status === "pending");
  const completedRequests = requestsWithUserData.filter((req) => req.status === "complete");

  // Stat: completed in the last 7 days
  const processedThisWeek = useMemo(() => {
    const weekAgo = subDays(new Date(), 7).getTime();
    return completedRequests.filter((req) => {
      const ms = req.completedAt?.seconds != null ? req.completedAt.seconds * 1000 : 0;
      return ms >= weekAgo;
    }).length;
  }, [completedRequests]);

  // Unique companies for client filter (include empty for "All clients")
  const clientOptions = useMemo(() => {
    const companies = new Set<string>();
    requestsWithUserData.forEach((r) => {
      const name = (r.companyName || "").trim();
      if (name) companies.add(name);
    });
    return Array.from(companies).sort((a, b) => a.localeCompare(b));
  }, [requestsWithUserData]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");

  // Search matches: documentType, userName, userEmail, companyName, contact, email, notes
  const matchesSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return () => true;
    return (req: typeof requestsWithUserData[0]) => {
      const str = [
        req.documentType,
        req.userName,
        req.userEmail,
        req.companyName,
        req.contact,
        req.email,
        req.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return str.includes(q);
    };
  }, [searchQuery]);

  const filteredPending = useMemo(() => {
    let list = pendingRequests;
    if (selectedClient !== "all") {
      list = list.filter((r) => (r.companyName || "").trim() === selectedClient);
    }
    return list.filter(matchesSearch);
  }, [pendingRequests, selectedClient, matchesSearch]);

  const filteredCompleted = useMemo(() => {
    let list = completedRequests;
    if (selectedClient !== "all") {
      list = list.filter((r) => (r.companyName || "").trim() === selectedClient);
    }
    return list.filter(matchesSearch);
  }, [completedRequests, selectedClient, matchesSearch]);

  const hasActiveFilters = searchQuery.trim() !== "" || selectedClient !== "all";

  const handleOpenUploadDialog = (request: DocumentRequest) => {
    setSelectedRequest(request);
    setFile(null);
    setUploadDialogOpen(true);
  };

  const handleUploadDocument = async () => {
    if (!selectedRequest || !file) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a file to upload.",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`File type not allowed. Please upload PDF, DOC, DOCX, or TXT files.`);
      }

      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new Error(`File size exceeds 50MB limit. Please upload a smaller file.`);
      }

      // Upload file to Firebase Storage
      const storagePath = `documentRequests/${selectedRequest.userId}/${selectedRequest.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      console.log("Uploading file to Firebase Storage:", storagePath);
      
      // Upload the file
      await uploadBytes(storageRef, file);
      console.log("File uploaded successfully");

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log("Download URL obtained:", downloadURL);

      // Update document request with file URL and status
      const requestRef = doc(db, `users/${selectedRequest.userId}/documentRequests`, selectedRequest.id);
      await updateDoc(requestRef, {
        status: "complete",
        documentUrl: downloadURL,
        fileName: file.name,
        completedAt: Timestamp.now(),
      });

      console.log("Document request updated in Firestore");

      toast({
        title: "Document Uploaded",
        description: "The document has been uploaded and is now available to the user.",
      });

      setUploadDialogOpen(false);
      setSelectedRequest(null);
      setFile(null);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      
      // Handle Firebase Storage errors
      let errorMessage = "Failed to upload document. Please try again.";
      
      if (error.code) {
        switch (error.code) {
          case 'storage/unauthorized':
            errorMessage = "You don't have permission to upload files. Please contact an administrator.";
            break;
          case 'storage/canceled':
            errorMessage = "Upload was canceled. Please try again.";
            break;
          case 'storage/unknown':
            errorMessage = "An unknown error occurred during upload. Please try again.";
            break;
          case 'storage/quota-exceeded':
            errorMessage = "Storage quota exceeded. Please contact an administrator.";
            break;
          case 'storage/unauthenticated':
            errorMessage = "Please log in to upload documents.";
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "document.pdf";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Document Requests</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage document requests from users
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 border-orange-200/50 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Pending</CardTitle>
            <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shadow-md">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-3xl font-bold text-orange-900">{pendingRequests.length}</div>
                <p className="text-xs text-orange-700 mt-1">Awaiting review</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200/50 bg-gradient-to-br from-green-50 to-green-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Completed</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-md">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-3xl font-bold text-green-900">{completedRequests.length}</div>
                <p className="text-xs text-green-700 mt-1">Fulfilled</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200/50 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Total Requests</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
              <FileStack className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-3xl font-bold text-blue-900">{requestsWithUserData.length}</div>
                <p className="text-xs text-blue-700 mt-1">All time</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-2 border-amber-200/50 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">Processed This Week</CardTitle>
            <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
              <CalendarCheck className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-3xl font-bold text-amber-900">{processedThisWeek}</div>
                <p className="text-xs text-amber-700 mt-1">Last 7 days</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, email, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clientOptions.map((company) => (
              <SelectItem key={company} value={company}>
                {company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Pending Requests
              </CardTitle>
              <CardDescription>
                Document requests awaiting your review and upload
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPending.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {hasActiveFilters
                      ? "No document requests match your filters."
                      : "No pending document requests."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPending.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{request.documentType}</p>
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              Pending
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{request.userName} ({request.userEmail})</span>
                          </div>
                          {request.companyName && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Company: {request.companyName}
                            </p>
                          )}
                          {request.contact && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Contact: {request.contact}
                            </p>
                          )}
                          {request.email && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Email: {request.email}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            Requested {format(new Date(request.requestedAt?.seconds * 1000 || Date.now()), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                          {request.notes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Notes: {request.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleOpenUploadDialog(request)}
                        className="ml-4"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Document
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Completed Requests
              </CardTitle>
              <CardDescription>
                Document requests that have been fulfilled
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCompleted.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {hasActiveFilters
                      ? "No document requests match your filters."
                      : "No completed document requests yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCompleted.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{request.documentType}</p>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Complete
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{request.userName} ({request.userEmail})</span>
                          </div>
                          {request.companyName && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Company: {request.companyName}
                            </p>
                          )}
                          {request.contact && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Contact: {request.contact}
                            </p>
                          )}
                          {request.email && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Email: {request.email}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            Completed {request.completedAt && format(new Date(request.completedAt?.seconds * 1000), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                          {request.fileName && (
                            <p className="text-sm text-muted-foreground mt-1">
                              File: {request.fileName}
                            </p>
                          )}
                        </div>
                      </div>
                      {request.documentUrl && (
                        <Button
                          variant="outline"
                          onClick={() => handleDownload(request.documentUrl!, request.fileName || "document.pdf")}
                          className="ml-4"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload the requested document for {selectedRequest?.userName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Input value={selectedRequest?.documentType || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, DOC, DOCX, TXT
              </p>
            </div>
            <Button
              onClick={handleUploadDocument}
              disabled={!file || isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
