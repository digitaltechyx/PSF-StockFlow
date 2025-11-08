"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { UploadedPDF } from "@/types";
import { PDFUpload } from "@/components/dashboard/pdf-upload";
import { PDFList } from "@/components/dashboard/pdf-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Upload as UploadIcon } from "lucide-react";

export default function LabelsPage() {
  const { userProfile, user } = useAuth();

  const {
    data: allUploadedPDFs,
    loading: uploadedPDFsLoading
  } = useCollection<UploadedPDF>("uploadedPDFs");

  const uploadedPDFs = userProfile?.role === "admin" 
    ? allUploadedPDFs 
    : allUploadedPDFs.filter((pdf) => pdf.uploadedBy === user?.uid);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <UploadIcon className="h-6 w-6" />
                Upload Labels
              </CardTitle>
              <CardDescription className="text-indigo-100 mt-2">
                Upload label files to Google Drive (No file size restrictions)
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Package className="h-7 w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {userProfile && user && (
            <PDFUpload
              userId={user.uid}
              userName={userProfile.name || `User_${user.uid}`}
              onUploadSuccess={() => {
                // PDF list will automatically refresh via useCollection hook
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Labels List */}
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Package className="h-6 w-6" />
                Labels Library
              </CardTitle>
              <CardDescription className="text-purple-100 mt-2">
                View and manage all uploaded labels ({uploadedPDFs.length} files)
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Package className="h-7 w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <PDFList
              pdfs={uploadedPDFs}
              loading={uploadedPDFsLoading}
              currentUserId={user?.uid}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
