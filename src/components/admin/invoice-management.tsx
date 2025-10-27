"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Download, CheckCircle, Clock, X, Eye, Receipt, User, Users } from "lucide-react";
import { generateInvoicePDF } from "@/lib/invoice-generator";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Invoice, type UserProfile } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import type { ShippedItem } from "@/types";

interface InvoiceManagementProps {
  users: UserProfile[];
}

interface UserInvoiceSummary {
  user: UserProfile;
  pendingCount: number;
  paidCount: number;
  totalAmount: number;
}

export function InvoiceManagement({ users }: InvoiceManagementProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedUserInvoices, setSelectedUserInvoices] = useState<Invoice[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInvoices, setUserInvoices] = useState<Record<string, Invoice[]>>({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [pendingInvoicesPage, setPendingInvoicesPage] = useState(1);
  const [paidInvoicesPage, setPaidInvoicesPage] = useState(1);
  const itemsPerPage = 10;
  
  // Load all invoices from all users
  const loadInvoices = async () => {
    setLoading(true);
    try {
      const invoicesMap: Record<string, Invoice[]> = {};
      
      for (const user of users) {
        const invoicesQuery = query(
          collection(db, `users/${user.uid}/invoices`),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(invoicesQuery);
        
        invoicesMap[user.uid] = snapshot.docs.map(doc => ({
          ...doc.data() as Invoice,
          id: doc.id,
        }));
      }
      
      setUserInvoices(invoicesMap);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load invoices.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [users]);

  // Calculate summary for each user
  const userSummaries: UserInvoiceSummary[] = users.map(user => {
    const invoices = userInvoices[user.uid] || [];
    const pendingCount = invoices.filter(inv => inv.status === 'pending').length;
    const paidCount = invoices.filter(inv => inv.status === 'paid').length;
    const totalAmount = invoices
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + inv.grandTotal, 0);
    
    return {
      user,
      pendingCount,
      paidCount,
      totalAmount,
    };
  });

  // Filter users based on search
  const filteredUsers = userSummaries.filter(({ user }) =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewUserInvoices = async (user: UserProfile) => {
    setSelectedUser(user);
    setSelectedUserInvoices(userInvoices[user.uid] || []);
    setIsDetailDialogOpen(true);
    // Reset date filters when opening a new user's invoices
    setStartDate("");
    setEndDate("");
  };

  // Filter invoices based on date range
  const getFilteredInvoices = (invoices: Invoice[]) => {
    if (!startDate && !endDate) return invoices;
    
    return invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start && end) {
        return invoiceDate >= start && invoiceDate <= end;
      } else if (start) {
        return invoiceDate >= start;
      } else if (end) {
        return invoiceDate <= end;
      }
      return true;
    });
  };

  const filteredPendingInvoices = getFilteredInvoices(selectedUserInvoices.filter(inv => inv.status === 'pending'));
  const filteredPaidInvoices = getFilteredInvoices(selectedUserInvoices.filter(inv => inv.status === 'paid'));

  // Pagination for users list
  const totalUsersPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const usersStartIndex = (usersPage - 1) * itemsPerPage;
  const usersEndIndex = usersStartIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(usersStartIndex, usersEndIndex);

  // Pagination for pending invoices
  const totalPendingInvoicesPages = Math.ceil(filteredPendingInvoices.length / itemsPerPage);
  const pendingStartIndex = (pendingInvoicesPage - 1) * itemsPerPage;
  const pendingEndIndex = pendingStartIndex + itemsPerPage;
  const paginatedPendingInvoices = filteredPendingInvoices.slice(pendingStartIndex, pendingEndIndex);

  // Pagination for paid invoices
  const totalPaidInvoicesPages = Math.ceil(filteredPaidInvoices.length / itemsPerPage);
  const paidStartIndex = (paidInvoicesPage - 1) * itemsPerPage;
  const paidEndIndex = paidStartIndex + itemsPerPage;
  const paginatedPaidInvoices = filteredPaidInvoices.slice(paidStartIndex, paidEndIndex);

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      await generateInvoicePDF({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        orderNumber: invoice.orderNumber,
        soldTo: invoice.soldTo,
        shipTo: invoice.shipTo,
        fbm: invoice.fbm,
        items: invoice.items,
      });
      
      toast({
        title: "Invoice Downloaded",
        description: `${invoice.invoiceNumber} has been downloaded.`,
      });
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download invoice.",
      });
    }
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    if (typeof date === 'string') return new Date(date).toLocaleDateString();
    return new Date(date.seconds * 1000).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Invoice Management
              </CardTitle>
              <CardDescription>View user invoices and payment status</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-yellow-600 bg-yellow-100">
                Total Pending: {userSummaries.reduce((sum, s) => sum + s.pendingCount, 0)}
              </Badge>
              <Badge variant="default" className="text-green-600 bg-green-100">
                Total Paid: {userSummaries.reduce((sum, s) => sum + s.paidCount, 0)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setUsersPage(1);
              }}
              className="pl-10"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>Click on a user to view their invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paginatedUsers.map(({ user, pendingCount, paidCount, totalAmount }) => (
                <Card 
                  key={user.uid} 
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary"
                  onClick={() => handleViewUserInvoices(user)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{user.name || 'Unnamed User'}</CardTitle>
                        <CardDescription className="mt-1">{user.email}</CardDescription>
                      </div>
                      {pendingCount > 0 && (
                        <Badge variant="destructive" className="h-6 w-6 flex items-center justify-center">
                          {pendingCount}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pending Invoices:</span>
                        <Badge variant={pendingCount > 0 ? "secondary" : "outline"}>
                          {pendingCount}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Paid Invoices:</span>
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          {paidCount}
                        </Badge>
                      </div>
                      {pendingCount > 0 && (
                        <div className="flex items-center justify-between text-sm pt-2 border-t">
                          <span className="font-semibold">Pending Amount:</span>
                          <span className="font-bold text-yellow-600">${totalAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No users found</h3>
              <p className="text-muted-foreground">
                {users.length === 0 ? "No users available." : "No users match your search."}
              </p>
            </div>
          )}

          {/* Pagination Controls for Users */}
          {filteredUsers.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {usersStartIndex + 1} to {Math.min(usersEndIndex, filteredUsers.length)} of {filteredUsers.length} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  disabled={usersPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {usersPage} of {totalUsersPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsersPage(p => Math.min(totalUsersPages, p + 1))}
                  disabled={usersPage === totalUsersPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Invoices Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {selectedUser?.name}'s Invoices
            </DialogTitle>
            <DialogDescription>
              View and manage all invoices for {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-6 mt-4">
              {/* User Info */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-semibold">{selectedUser.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-semibold">{selectedUser.email}</p>
                  </div>
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-semibold text-sm">Filter by Date Range</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">From Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">To Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                {(startDate || endDate) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="w-full"
                  >
                    Clear Filter
                  </Button>
                )}
              </div>

              {/* Pending Invoices */}
              {filteredPendingInvoices.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    Pending Invoices ({filteredPendingInvoices.length})
                  </h3>
                  <div className="space-y-3">
                    {paginatedPendingInvoices.map((invoice) => (
                        <div key={invoice.id} className="p-4 border rounded-lg bg-yellow-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{invoice.invoiceNumber}</h4>
                                <Badge variant="secondary">Pending</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>Date: {invoice.date}</p>
                                <p>Customer: {invoice.soldTo.name}</p>
                                <p className="font-semibold text-lg">Total: ${invoice.grandTotal.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewInvoice(invoice)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadInvoice(invoice)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Paid Invoices */}
              {filteredPaidInvoices.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Paid Invoices ({filteredPaidInvoices.length})
                  </h3>
                  <div className="space-y-3">
                    {paginatedPaidInvoices.map((invoice) => (
                        <div key={invoice.id} className="p-4 border rounded-lg bg-green-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{invoice.invoiceNumber}</h4>
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  Paid
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p>Date: {invoice.date}</p>
                                <p>Customer: {invoice.soldTo.name}</p>
                                <p className="font-semibold text-lg">Total: ${invoice.grandTotal.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewInvoice(invoice)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadInvoice(invoice)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {selectedUserInvoices.length === 0 && (
                <div className="text-center py-12">
                  <Receipt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
                  <p className="text-muted-foreground">This user has no invoices yet.</p>
                </div>
              )}

              {/* Pagination for Pending Invoices */}
              {filteredPendingInvoices.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {pendingStartIndex + 1} to {Math.min(pendingEndIndex, filteredPendingInvoices.length)} of {filteredPendingInvoices.length} pending invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingInvoicesPage(p => Math.max(1, p - 1))}
                      disabled={pendingInvoicesPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {pendingInvoicesPage} of {totalPendingInvoicesPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingInvoicesPage(p => Math.min(totalPendingInvoicesPages, p + 1))}
                      disabled={pendingInvoicesPage === totalPendingInvoicesPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Pagination for Paid Invoices */}
              {filteredPaidInvoices.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {paidStartIndex + 1} to {Math.min(paidEndIndex, filteredPaidInvoices.length)} of {filteredPaidInvoices.length} paid invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaidInvoicesPage(p => Math.max(1, p - 1))}
                      disabled={paidInvoicesPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {paidInvoicesPage} of {totalPaidInvoicesPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaidInvoicesPage(p => Math.min(totalPaidInvoicesPages, p + 1))}
                      disabled={paidInvoicesPage === totalPaidInvoicesPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Invoice Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice Details
            </DialogTitle>
            <DialogDescription>
              View complete invoice information
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6 mt-4">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-semibold">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">{selectedInvoice.date}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={selectedInvoice.status === 'paid' ? 'default' : 'secondary'}>
                    {selectedInvoice.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Sold To & Ship To */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Sold To</h4>
                  <p className="text-sm">{selectedInvoice.soldTo.name}</p>
                  {selectedInvoice.soldTo.address && <p className="text-sm text-muted-foreground">{selectedInvoice.soldTo.address}</p>}
                  {selectedInvoice.soldTo.phone && <p className="text-sm text-muted-foreground">{selectedInvoice.soldTo.phone}</p>}
                  <p className="text-sm text-muted-foreground">{selectedInvoice.soldTo.email}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Ship To</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedInvoice.shipTo}</p>
                  <p className="text-sm text-muted-foreground mt-2">FBM: {selectedInvoice.fbm}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-2 grid grid-cols-5 gap-2 text-sm font-semibold">
                  <div>Qty</div>
                  <div className="col-span-2">Product</div>
                  <div>Unit Price</div>
                  <div>Amount</div>
                </div>
                {selectedInvoice.items.map((item, idx) => (
                  <div key={idx} className="p-2 grid grid-cols-5 gap-2 text-sm border-t">
                    <div>{item.quantity}</div>
                    <div className="col-span-2">{item.productName}</div>
                    <div>${item.unitPrice.toFixed(2)}</div>
                    <div className="font-semibold">${item.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>NJ Sales Tax 6.625% - Excluded</span>
                    <span>-</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-bold text-lg">
                    <span>Grand Total:</span>
                    <span>${selectedInvoice.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadInvoice(selectedInvoice)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
