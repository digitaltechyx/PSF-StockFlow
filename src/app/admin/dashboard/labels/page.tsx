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
    <div className="space-y-6">
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Package className="h-6 w-6" />
                Labels Management
              </CardTitle>
              <CardDescription className="text-pink-100 mt-2">
                View and manage all uploaded labels ({allUploadedPDFs.length} files)
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Package className="h-7 w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <PDFManagement pdfs={allUploadedPDFs} loading={pdfsLoading} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


