"use client";

import { useAuth } from "@/hooks/use-auth";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile, Invoice, Commission } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, XCircle, DollarSign, FileText, Copy, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AgentDashboardPage() {
  const { userProfile } = useAuth();
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch all users to find referred clients
  const { data: allUsers, loading: usersLoading } = useCollection<UserProfile>("users");
  
  // Fetch commissions - only for this agent
  const commissionsQuery = useMemo(() => {
    if (!userProfile?.uid) return undefined;
    return query(
      collection(db, "commissions"),
      where("agentId", "==", userProfile.uid)
    );
  }, [userProfile?.uid]);

  const { data: commissions, loading: commissionsLoading } = useCollection<Commission>(
    userProfile ? "commissions" : "",
    commissionsQuery
  );

  // Get referred clients (users who used this agent's referral code)
  const referredClients = useMemo(() => {
    if (!userProfile?.uid) return [];
    return allUsers.filter(
      (user) => user.referredByAgentId === userProfile.uid && user.role === "user"
    );
  }, [allUsers, userProfile?.uid]);

  // Categorize clients
  const activeClients = useMemo(() => {
    return referredClients.filter((client) => client.status === "approved" || !client.status);
  }, [referredClients]);

  const pendingClients = useMemo(() => {
    return referredClients.filter((client) => client.status === "pending");
  }, [referredClients]);

  const rejectedClients = useMemo(() => {
    return referredClients.filter((client) => client.status === "deleted");
  }, [referredClients]);

  // Get invoices from referred clients (from commissions)
  // Note: Commissions are only created when invoices are paid, so all commissions represent paid invoices
  const paidInvoices = useMemo(() => {
    if (!userProfile?.uid) return [];
    // Get all commissions for this agent (all represent paid invoices)
    return commissions
      .filter((c) => c.agentId === userProfile.uid)
      .map((c) => ({
        id: c.invoiceId,
        invoiceNumber: c.invoiceNumber,
        grandTotal: c.invoiceAmount,
        status: "paid" as const,
        date: c.createdAt,
        userId: c.clientId,
        commissionStatus: c.status, // Track commission payment status separately
      })) as (Invoice & { commissionStatus?: string })[];
  }, [commissions, userProfile?.uid]);

  // Calculate total commission (pending commissions)
  const totalCommission = useMemo(() => {
    const pendingCommissions = commissions.filter((c) => c.status === "pending");
    return pendingCommissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
  }, [commissions]);

  const copyReferralCode = () => {
    if (userProfile?.referralCode) {
      navigator.clipboard.writeText(userProfile.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    try {
      let dateObj: Date;
      if (date && typeof date === 'object' && date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }
      if (isNaN(dateObj.getTime())) return "N/A";
      return format(dateObj, "MMM dd, yyyy");
    } catch {
      return "N/A";
    }
  };

  if (usersLoading || commissionsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Referral Code Banner - Enhanced */}
        {userProfile?.referralCode && (
          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0YzAtMTEuMDQ2LTguOTU0LTIwLTIwLTIwUy00IDIyLjk1NC00IDM0czguOTU0IDIwIDIwIDIwIDIwLTguOTU0IDIwLTIweiIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>
            <CardContent className="relative p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Copy className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold">Your Referral Code</h3>
                  </div>
                  <p className="text-blue-100 mb-4 text-sm sm:text-base">
                    Share this code with potential clients to earn commissions
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-6 py-3">
                      <span className="text-3xl sm:text-4xl font-mono font-bold tracking-wider">
                        {userProfile.referralCode}
                      </span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="lg"
                          className="h-12 w-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 shadow-lg transition-all hover:scale-110"
                          onClick={copyReferralCode}
                        >
                          {copiedCode ? (
                            <Check className="h-5 w-5 text-green-300" />
                          ) : (
                            <Copy className="h-5 w-5 text-white" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy referral code</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards - Enhanced with gradients */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-green-200/50 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-green-900">Total Active Clients</CardTitle>
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-900 mb-1">{activeClients.length}</div>
              <p className="text-xs font-medium text-green-700">
                Clients with approved status
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200/50 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-amber-900">Total Pending Clients</CardTitle>
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                <Users className="h-6 w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-900 mb-1">{pendingClients.length}</div>
              <p className="text-xs font-medium text-amber-700">
                Clients awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200/50 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-purple-900">Total Commission</CardTitle>
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-purple-900 mb-1">${totalCommission.toFixed(2)}</div>
              <p className="text-xs font-medium text-purple-700">
                Pending commission amount
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Four Sections Grid - Enhanced */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Clients */}
          <Card className="border-2 border-green-200/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    Active Clients
                  </CardTitle>
                  <CardDescription className="text-green-100 mt-1">
                    Clients you referred with approved status ({activeClients.length})
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {activeClients.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto p-4">
                  {activeClients.map((client) => (
                    <div
                      key={client.uid}
                      className="flex items-center justify-between p-4 border-2 border-green-100 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-green-900 truncate">{client.name}</p>
                        <p className="text-sm text-green-700 truncate">{client.email}</p>
                        {client.companyName && (
                          <p className="text-xs text-green-600 truncate mt-1">{client.companyName}</p>
                        )}
                      </div>
                      <Badge className="ml-3 bg-green-600 hover:bg-green-700 text-white shadow-sm">Active</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <UserCheck className="h-8 w-8 text-green-400" />
                  </div>
                  <p className="font-semibold text-green-900">No active clients yet</p>
                  <p className="text-sm text-green-600 mt-1">Start sharing your referral code!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Clients */}
          <Card className="border-2 border-amber-200/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-600 text-white pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Users className="h-5 w-5" />
                    </div>
                    Pending Clients
                  </CardTitle>
                  <CardDescription className="text-amber-100 mt-1">
                    Clients awaiting approval ({pendingClients.length})
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pendingClients.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto p-4">
                  {pendingClients.map((client) => (
                    <div
                      key={client.uid}
                      className="flex items-center justify-between p-4 border-2 border-amber-100 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-amber-900 truncate">{client.name}</p>
                        <p className="text-sm text-amber-700 truncate">{client.email}</p>
                        {client.companyName && (
                          <p className="text-xs text-amber-600 truncate mt-1">{client.companyName}</p>
                        )}
                      </div>
                      <Badge className="ml-3 bg-amber-500 hover:bg-amber-600 text-white shadow-sm">Pending</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                    <Users className="h-8 w-8 text-amber-400" />
                  </div>
                  <p className="font-semibold text-amber-900">No pending clients</p>
                  <p className="text-sm text-amber-600 mt-1">All clients have been processed</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rejected Clients */}
          <Card className="border-2 border-red-200/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-red-500 to-rose-600 text-white pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <XCircle className="h-5 w-5" />
                    </div>
                    Rejected Clients
                  </CardTitle>
                  <CardDescription className="text-red-100 mt-1">
                    Clients that were rejected ({rejectedClients.length})
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rejectedClients.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto p-4">
                  {rejectedClients.map((client) => (
                    <div
                      key={client.uid}
                      className="flex items-center justify-between p-4 border-2 border-red-100 rounded-xl bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-red-900 truncate">{client.name}</p>
                        <p className="text-sm text-red-700 truncate">{client.email}</p>
                        {client.companyName && (
                          <p className="text-xs text-red-600 truncate mt-1">{client.companyName}</p>
                        )}
                      </div>
                      <Badge variant="destructive" className="ml-3 shadow-sm">Rejected</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-red-400" />
                  </div>
                  <p className="font-semibold text-red-900">No rejected clients</p>
                  <p className="text-sm text-red-600 mt-1">Great job! All clients are active</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Paid Invoices */}
          <Card className="border-2 border-blue-200/50 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <FileText className="h-5 w-5" />
                    </div>
                    Paid Invoices
                  </CardTitle>
                  <CardDescription className="text-blue-100 mt-1">
                    Invoices paid by your onboarded clients ({paidInvoices.length})
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {paidInvoices.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-blue-50/50">
                      <TableRow className="hover:bg-blue-50/50">
                        <TableHead className="font-semibold text-blue-900">Invoice #</TableHead>
                        <TableHead className="font-semibold text-blue-900">Client</TableHead>
                        <TableHead className="font-semibold text-blue-900">Amount</TableHead>
                        <TableHead className="font-semibold text-blue-900">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidInvoices.map((invoice) => {
                        const client = referredClients.find((c) => c.uid === invoice.userId);
                        return (
                          <TableRow key={invoice.id} className="hover:bg-blue-50/30 transition-colors">
                            <TableCell className="font-mono text-sm font-medium">
                              {invoice.invoiceNumber}
                            </TableCell>
                            <TableCell className="font-medium">{client?.name || "Unknown"}</TableCell>
                            <TableCell className="font-semibold text-green-600">
                              ${invoice.grandTotal.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(invoice.date)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-blue-400" />
                  </div>
                  <p className="font-semibold text-blue-900">No paid invoices yet</p>
                  <p className="text-sm text-blue-600 mt-1">Invoices will appear here once clients pay</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}

