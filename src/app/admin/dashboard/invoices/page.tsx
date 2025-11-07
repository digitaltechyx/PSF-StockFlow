"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, DollarSign } from "lucide-react";
import { InvoiceManagement } from "@/components/admin/invoice-management";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile } from "@/types";

export default function AdminInvoicesPage() {
  const { data: users } = useCollection<UserProfile>("users");

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Invoice Management
              </CardTitle>
              <CardDescription className="text-indigo-100 mt-2">
                View and manage all invoices across all users
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <DollarSign className="h-7 w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <InvoiceManagement users={users} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


