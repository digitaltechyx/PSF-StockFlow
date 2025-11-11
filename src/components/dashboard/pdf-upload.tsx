"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, X, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { uploadPDF, type UploadProgress } from "@/lib/pdf-upload";
import { compressPDF } from "@/lib/pdf-compression";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getFolderInfo } from "@/lib/pdf-upload";
import type { UploadedPDF } from "@/types";
import { 
  isUploadTimeAllowed, 
  getNewJerseyTimeString, 
  getTimeUntilNextUploadWindow,
  getUploadWindowDescription 
} from "@/lib/time-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PDFUploadProps {
  userId: string;
  userName: string;
  onUploadSuccess?: () => void;
}

interface FileUploadState {
  file: File;
  originalFile: File;
  status: "pending" | "compressing" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export function PDFUpload({ userId, userName, onUploadSuccess }: PDFUploadProps) {
  const { toast } = useToast();
  const [fileUploads, setFileUploads] = useState<FileUploadState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>(getNewJerseyTimeString());
  const [uploadAllowed, setUploadAllowed] = useState<boolean>(isUploadTimeAllowed());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getNewJerseyTimeString());
      setUploadAllowed(isUploadTimeAllowed());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: FileUploadState[] = Array.from(files).map((file) => ({
      file,
      originalFile: file,
      status: "pending",
      progress: 0,
    }));

    setFileUploads((prev) => [...prev, ...newFiles]);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    // Check if uploads are allowed at this time
    if (!isUploadTimeAllowed()) {
      toast({
        variant: "destructive",
        title: "Upload Not Allowed",
        description: `Uploads are only allowed between 12:00 AM - 11:00 AM (New Jersey Time) for same day fulfilment. ${getTimeUntilNextUploadWindow()}`,
      });
      return;
    }

    if (fileUploads.length === 0) {
      toast({
        variant: "destructive",
        title: "No Files Selected",
        description: "Please select at least one PDF file to upload.",
      });
      return;
    }

    setIsUploading(true);
    const currentDate = new Date();
    const folderInfo = getFolderInfo(currentDate);

    // Upload all files
    const uploadPromises = fileUploads.map(async (fileState, index) => {
      try {
        // Step 1: Compress PDF
        setFileUploads((prev) => {
          const updated = [...prev];
          updated[index] = { ...updated[index], status: "compressing", progress: 0 };
          return updated;
        });

        const compressionResult = await compressPDF(fileState.originalFile);

        // Always proceed with upload, even if compression didn't reduce size significantly
        // Compression is attempted but upload is allowed regardless of final size
        if (!compressionResult.file) {
          // If compression completely failed, use original file
          compressionResult.file = fileState.originalFile;
          compressionResult.compressedSize = fileState.originalFile.size;
          compressionResult.compressionRatio = 0;
        }

        // Step 2: Upload to Firebase Storage
        setFileUploads((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            file: compressionResult.file!,
            status: "uploading",
            progress: 0,
          };
          return updated;
        });

        const result = await uploadPDF(
          compressionResult.file,
          userName,
          (progress: UploadProgress) => {
            setFileUploads((prev) => {
              const updated = [...prev];
              updated[index] = { ...updated[index], progress: progress.progress };
              return updated;
            });
          }
        );

        if (!result.success || !result.storagePath || !result.downloadURL) {
          throw new Error(result.error || "Failed to upload PDF");
        }

        // Step 3: Save metadata to Firestore
        const pdfMetadata: Omit<UploadedPDF, "id"> = {
          fileName: fileState.originalFile.name,
          storagePath: result.storagePath,
          downloadURL: result.downloadURL,
          size: compressionResult.file.size,
          uploadedAt: serverTimestamp(),
          uploadedBy: userId,
          uploadedByName: userName,
          year: folderInfo.year,
          month: folderInfo.month,
          date: folderInfo.date,
        };

        await addDoc(collection(db, "uploadedPDFs"), pdfMetadata);

        // Step 4: Mark as success
        setFileUploads((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: "success",
            progress: 100,
          };
          return updated;
        });

        toast({
          title: "PDF Uploaded Successfully",
          description: `${fileState.originalFile.name} has been uploaded.`,
        });
      } catch (error: any) {
        console.error(`Error uploading ${fileState.originalFile.name}:`, error);
        setFileUploads((prev) => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: "error",
            error: error.message || "Failed to upload PDF",
          };
          return updated;
        });
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: `Failed to upload ${fileState.originalFile.name}: ${error.message || "Unknown error"}`,
        });
      }
    });

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    // Check if all files are done
    const allDone = fileUploads.every(
      (f) => f.status === "success" || f.status === "error"
    );

    if (allDone) {
      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    }

    setIsUploading(false);
  };

  const handleRemoveFile = (index: number) => {
    setFileUploads((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setFileUploads([]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const pendingFiles = fileUploads.filter((f) => f.status === "pending");
  const uploadingFiles = fileUploads.filter(
    (f) => f.status === "compressing" || f.status === "uploading"
  );
  const successFiles = fileUploads.filter((f) => f.status === "success");
  const errorFiles = fileUploads.filter((f) => f.status === "error");

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Time Display and Upload Window Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>New Jersey Time: <span className="font-mono font-semibold">{currentTime}</span></span>
          </div>
          <div className={`flex items-center gap-2 ${uploadAllowed ? 'text-green-600' : 'text-red-600'}`}>
            {uploadAllowed ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">Uploads Allowed</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Uploads Disabled</span>
              </>
            )}
          </div>
        </div>
        
        {!uploadAllowed && (
          <Alert variant="destructive" className="py-2 flex items-center gap-3 [&>svg]:relative [&>svg]:left-0 [&>svg]:top-0 [&>svg]:translate-y-0 [&>svg~*]:pl-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <AlertDescription className="text-xs sm:text-sm text-left flex-1">
              {getUploadWindowDescription()}. {getTimeUntilNextUploadWindow()}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full">
        <label className="flex-1 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !uploadAllowed}
          >
            <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">
              {fileUploads.length === 0 ? "Select Labels" : `Add More (${fileUploads.length})`}
            </span>
          </Button>
        </label>

        {fileUploads.length > 0 && (
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={isUploading}
              className="flex-1 sm:flex-initial"
            >
              Clear All
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || pendingFiles.length === 0 || !uploadAllowed}
              className="flex items-center gap-2 flex-1 sm:flex-initial"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  <span className="hidden sm:inline">Uploading...</span>
                  <span className="sm:hidden">Upload...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">
                    Upload {pendingFiles.length > 0 ? `${pendingFiles.length} ` : ""}Label{pendingFiles.length !== 1 ? "s" : ""}
                  </span>
                  <span className="sm:hidden">
                    Upload {pendingFiles.length > 0 ? pendingFiles.length : ""}
                  </span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {fileUploads.length > 0 && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {fileUploads.map((fileState, index) => (
            <div
              key={index}
              className={`p-3 border rounded-lg ${
                fileState.status === "success"
                  ? "bg-green-50 border-green-200"
                  : fileState.status === "error"
                  ? "bg-red-50 border-red-200"
                  : "bg-muted/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {fileState.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  ) : fileState.status === "error" ? (
                    <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {fileState.originalFile.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>Original: {formatFileSize(fileState.originalFile.size)}</span>
                      {fileState.file !== fileState.originalFile && (
                        <span className="text-green-600">
                          → Compressed: {formatFileSize(fileState.file.size)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {fileState.status !== "success" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFile(index)}
                    disabled={isUploading}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {(fileState.status === "compressing" || fileState.status === "uploading") && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>
                      {fileState.status === "compressing" ? "Compressing..." : "Uploading..."}
                    </span>
                    <span>{fileState.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        fileState.status === "compressing" ? "bg-yellow-500" : "bg-primary"
                      }`}
                      style={{ width: `${fileState.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {fileState.status === "error" && fileState.error && (
                <div className="mt-2 text-xs text-red-600">{fileState.error}</div>
              )}

              {fileState.status === "success" && (
                <div className="mt-2 text-xs text-green-600">Uploaded successfully!</div>
              )}
            </div>
          ))}
        </div>
      )}

      {fileUploads.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {successFiles.length > 0 && (
            <span className="text-green-600">
              {successFiles.length} uploaded successfully
            </span>
          )}
          {successFiles.length > 0 && errorFiles.length > 0 && " • "}
          {errorFiles.length > 0 && (
            <span className="text-red-600">{errorFiles.length} failed</span>
          )}
          {uploadingFiles.length > 0 && (
            <>
              {successFiles.length > 0 || errorFiles.length > 0 ? " • " : ""}
              <span className="text-blue-600">{uploadingFiles.length} uploading...</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
