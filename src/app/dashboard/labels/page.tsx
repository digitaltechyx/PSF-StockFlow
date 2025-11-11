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
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Upload Section */}
      <Card className="border-2 shadow-xl overflow-hidden w-full min-w-0">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white pb-3 sm:pb-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                <UploadIcon className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                <span className="truncate">Upload Labels</span>
              </CardTitle>
              <CardDescription className="text-indigo-100 mt-1 sm:mt-2 text-xs sm:text-sm">
                Upload your label files. Uploads allowed between 12:00 AM - 11:59 AM (New Jersey Time)
              </CardDescription>
            </div>
            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
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
      <Card className="border-2 shadow-xl overflow-hidden w-full min-w-0">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-600 text-white pb-3 sm:pb-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                <span className="truncate">Labels Library</span>
              </CardTitle>
              <CardDescription className="text-purple-100 mt-1 sm:mt-2 text-xs sm:text-sm">
                View and manage all uploaded labels ({uploadedPDFs.length} files)
              </CardDescription>
            </div>
            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 sm:p-6">
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
