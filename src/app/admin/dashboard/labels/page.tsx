"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { PDFManagement } from "@/components/admin/pdf-management";
import { useCollection } from "@/hooks/use-collection";
import type { UploadedPDF } from "@/types";

export default function AdminLabelsPage() {
  const {
    data: allUploadedPDFs,
    loading: pdfsLoading
  } = useCollection<UploadedPDF>("uploadedPDFs");

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      <Card className="border-2 shadow-xl overflow-hidden w-full min-w-0">
        <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-600 text-white pb-3 sm:pb-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
                <span className="truncate">Labels Management</span>
              </CardTitle>
              <CardDescription className="text-pink-100 mt-1 sm:mt-2 text-xs sm:text-sm">
                View and manage all uploaded labels ({allUploadedPDFs.length} files)
              </CardDescription>
            </div>
            <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 sm:p-6">
            <PDFManagement pdfs={allUploadedPDFs} loading={pdfsLoading} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


