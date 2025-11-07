"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { Invoice } from "@/types";
import { InvoicesSection } from "@/components/dashboard/invoices-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, DollarSign } from "lucide-react";

export default function InvoicesPage() {
  const { userProfile } = useAuth();

  const {
    data: invoices,
    loading: invoicesLoading
  } = useCollection<Invoice>(
    userProfile ? `users/${userProfile.uid}/invoices` : ""
  );

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-2 border-purple-200/50 bg-gradient-to-br from-purple-50 to-purple-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Paid Invoices</CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center shadow-md">
              <Receipt className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{paidInvoices.length}</div>
            <p className="text-xs text-purple-700 mt-1">Paid invoices</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200/50 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Pending Invoices</CardTitle>
            <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shadow-md">
              <Receipt className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">{pendingInvoices.length}</div>
            <p className="text-xs text-orange-700 mt-1">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200/50 bg-gradient-to-br from-green-50 to-green-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Total Pending Amount</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-md">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">${pendingAmount.toFixed(2)}</div>
            <p className="text-xs text-green-700 mt-1">Pending invoices total</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Section */}
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Receipt className="h-6 w-6" />
                Invoices
              </CardTitle>
              <CardDescription className="text-purple-100 mt-2">
                View and manage all your invoices ({invoices.length} total)
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <DollarSign className="h-7 w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <InvoicesSection invoices={invoices} loading={invoicesLoading} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
