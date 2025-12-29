"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import { collectionGroup, query, where, doc, updateDoc, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { FileText, Upload, Loader2, CheckCircle, Clock, Download, User } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
      // Upload file to Firebase Storage
      const storagePath = `documentRequests/${selectedRequest.userId}/${selectedRequest.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      // Upload the file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update document request with file URL and status
      const requestRef = doc(db, `users/${selectedRequest.userId}/documentRequests`, selectedRequest.id);
      await updateDoc(requestRef, {
        status: "complete",
        documentUrl: downloadURL,
        fileName: file.name,
        completedAt: Timestamp.now(),
      });

      toast({
        title: "Document Uploaded",
        description: "The document has been uploaded and is now available to the user.",
      });

      setUploadDialogOpen(false);
      setSelectedRequest(null);
      setFile(null);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to upload document. Please try again.",
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
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending document requests.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
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
              ) : completedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed document requests yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {completedRequests.map((request) => (
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
