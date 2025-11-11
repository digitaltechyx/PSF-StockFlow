"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useCollection } from "@/hooks/use-collection";
import type { UserProfile, InventoryItem, ShippedItem, UploadedPDF, Invoice } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Search, Users, Package, FileText, Shield, Receipt, ChevronsUpDown, Check } from "lucide-react";
import { AdminInventoryManagement } from "@/components/admin/admin-inventory-management";
import { Skeleton } from "@/components/ui/skeleton";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";


export default function AdminDashboardPage() {
  const { userProfile: adminUser } = useAuth();
  const { data: users, loading: usersLoading } = useCollection<UserProfile>("users");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Filter approved users (excluding deleted users), pin admin first, then sort A-Z
  const approvedUsers = useMemo(() => {
    const filtered = users
      .filter((user) => user.status !== "deleted")
      .filter((user) => {
        return user.status === "approved" || !user.status;
      });
    
    // Separate admin and other users
    const admin = filtered.find((user) => user.uid === adminUser?.uid);
    const others = filtered.filter((user) => user.uid !== adminUser?.uid);
    
    // Sort others A-Z
    const sortedOthers = others.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    // Pin admin first, then others
    return admin ? [admin, ...sortedOthers] : sortedOthers;
  }, [users, adminUser]);

  // Set default selected user to admin on initial load
  useEffect(() => {
    // Only set default if no user is currently selected
    if (selectedUserId) return;
    
    if (adminUser?.uid && approvedUsers.length > 0) {
      // Explicitly find and select admin user
      const admin = approvedUsers.find(user => user.uid === adminUser.uid);
      if (admin) {
        setSelectedUserId(admin.uid);
        return;
      }
    }
    
    // Fallback: select first user (which should be admin since it's pinned first)
    if (approvedUsers.length > 0) {
      setSelectedUserId(approvedUsers[0].uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedUsers, adminUser]);

  const selectedUser = approvedUsers.find(u => u.uid === selectedUserId) || null;
  
  // Get inventory and shipped data for selected user
  const { data: inventory, loading: inventoryLoading } = useCollection<InventoryItem>(
    selectedUser ? `users/${selectedUser.uid}/inventory` : ""
  );
  const { data: shipped, loading: shippedLoading } = useCollection<ShippedItem>(
    selectedUser ? `users/${selectedUser.uid}/shipped` : ""
  );
  const activeUsersCount = users.filter((user) => 
    user.uid !== adminUser?.uid && (user.status === "approved" || !user.status) && user.status !== "deleted"
  ).length;
  const pendingUsersCount = users.filter((user) => 
    user.uid !== adminUser?.uid && user.status === "pending"
  ).length;

  // Get all inventory and shipped items for stats
  const { data: allUploadedPDFs } = useCollection<UploadedPDF>("uploadedPDFs");
  
  // Track current date to update when date changes
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // Update current date every minute to catch date changes
  useEffect(() => {
    const updateDate = () => {
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setCurrentDate(todayString);
    };

    // Update immediately
    updateDate();

    // Update every minute to catch date changes
    const interval = setInterval(updateDate, 60000);

    return () => clearInterval(interval);
  }, []);

  // Filter labels by current date
  const getTodayLabelsCount = useMemo(() => {
    return allUploadedPDFs.filter((pdf) => {
      // First try to use the date field if available
      if (pdf.date) {
        return pdf.date === currentDate;
      }
      
      // Otherwise, parse uploadedAt
      if (!pdf.uploadedAt) return false;
      
      let pdfDate: Date;
      if (typeof pdf.uploadedAt === 'string') {
        pdfDate = new Date(pdf.uploadedAt);
      } else if (pdf.uploadedAt.seconds) {
        pdfDate = new Date(pdf.uploadedAt.seconds * 1000);
      } else {
        return false;
      }
      
      const pdfDateString = `${pdfDate.getFullYear()}-${String(pdfDate.getMonth() + 1).padStart(2, '0')}-${String(pdfDate.getDate()).padStart(2, '0')}`;
      return pdfDateString === currentDate;
    }).length;
  }, [allUploadedPDFs, currentDate]);

  // Get pending invoices count and amount
  const [pendingInvoicesCount, setPendingInvoicesCount] = useState(0);
  const [pendingInvoicesAmount, setPendingInvoicesAmount] = useState(0);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  useEffect(() => {
    const fetchPendingInvoices = async () => {
      try {
        setInvoicesLoading(true);
        let totalPending = 0;
        let totalPendingAmount = 0;
        
        for (const user of users) {
          if (user.uid === adminUser?.uid) continue;
          try {
            const invoicesRef = collection(db, `users/${user.uid}/invoices`);
            const invoicesSnapshot = await getDocs(invoicesRef);
            const userInvoices = invoicesSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Invoice[];
            
            const pending = userInvoices.filter(inv => inv.status === 'pending');
            totalPending += pending.length;
            totalPendingAmount += pending.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
          } catch (error) {
            console.error(`Error fetching invoices for user ${user.uid}:`, error);
          }
        }
        
        setPendingInvoicesCount(totalPending);
        setPendingInvoicesAmount(totalPendingAmount);
      } catch (error) {
        console.error('Error fetching pending invoices:', error);
      } finally {
        setInvoicesLoading(false);
      }
    };

    if (users.length > 0) {
      fetchPendingInvoices();
    }
  }, [users, adminUser]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-2 border-orange-200/50 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-900">Pending Users</CardTitle>
            <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shadow-md">
              <Shield className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">{pendingUsersCount}</div>
            <p className="text-xs text-orange-700 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200/50 bg-gradient-to-br from-green-50 to-green-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Active Users</CardTitle>
            <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-md">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{activeUsersCount}</div>
            <p className="text-xs text-green-700 mt-1">Approved users</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200/50 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Number of Pending Invoices</CardTitle>
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
              <Receipt className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-3xl font-bold text-blue-900">{pendingInvoicesCount}</div>
                <p className="text-xs text-blue-700 mt-1">Pending Amount: ${pendingInvoicesAmount.toFixed(2)}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200/50 bg-gradient-to-br from-purple-50 to-purple-100/50 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">Today's Labels</CardTitle>
            <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center shadow-md">
              <FileText className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{getTodayLabelsCount}</div>
            <p className="text-xs text-purple-700 mt-1">Uploaded today</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Card */}
      <Card className="border-2 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Package className="h-6 w-6" />
                Inventory Management
              </CardTitle>
              <CardDescription className="text-purple-100 mt-2">
                Manage inventory for users
              </CardDescription>
            </div>
            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Package className="h-7 w-7 text-white" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* User Selector */}
          <div className="mb-6 pb-6 border-b">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Select User:</span>
              </div>
              <div className="flex-1 w-full sm:w-auto">
                {usersLoading ? (
                  <Skeleton className="h-11 w-full sm:w-[300px]" />
                ) : (
                  <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={userDialogOpen}
                        className="w-full sm:w-[300px] h-11 justify-between shadow-sm min-w-0 px-3"
                      >
                        <span className="truncate text-left flex-1 min-w-0 mr-2">
                          {selectedUser
                            ? `${selectedUser.name || 'Unnamed User'} (${selectedUser.email})`
                            : "Select a user to manage inventory"}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="p-0">
                      <DialogTitle className="sr-only">Select a user</DialogTitle>
                      <div className="p-3 border-b">
                        <Input
                          autoFocus
                          placeholder="Search users..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const normalized = userSearchQuery.trim().toLowerCase();
                              const matches = approvedUsers.filter(user =>
                                user.name?.toLowerCase().includes(normalized) ||
                                user.email?.toLowerCase().includes(normalized)
                              );
                              const first = matches[0] ?? approvedUsers[0];
                              if (first) {
                                setSelectedUserId(first.uid);
                                setUserDialogOpen(false);
                                setUserSearchQuery("");
                              }
                            }
                          }}
                        />
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {approvedUsers
                          .filter(user =>
                            user.name?.toLowerCase().includes(userSearchQuery.trim().toLowerCase()) ||
                            user.email?.toLowerCase().includes(userSearchQuery.trim().toLowerCase())
                          )
                          .map((user, index) => (
                            <div
                              key={user.uid || `user-${index}`}
                              role="button"
                              tabIndex={0}
                              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer min-w-0"
                              onClick={() => {
                                setSelectedUserId(user.uid);
                                setUserDialogOpen(false);
                                setUserSearchQuery("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setSelectedUserId(user.uid);
                                  setUserDialogOpen(false);
                                  setUserSearchQuery("");
                                }
                              }}
                            >
                              <Check className={`h-4 w-4 shrink-0 ${selectedUserId === user.uid ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="truncate min-w-0 flex-1">
                                {user.name || 'Unnamed User'} ({user.email})
                              </span>
                            </div>
                          ))}
                        {approvedUsers.filter(user =>
                          user.name?.toLowerCase().includes(userSearchQuery.trim().toLowerCase()) ||
                          user.email?.toLowerCase().includes(userSearchQuery.trim().toLowerCase())
                        ).length === 0 && (
                          <div key="no-users" className="px-3 py-4 text-sm text-muted-foreground">No users found.</div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </div>

          {/* Inventory Management */}
          {!selectedUser ? (
            <div className="text-center py-16">
              <div className="mx-auto h-20 w-20 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <Package className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">No user selected</h3>
              <p className="text-muted-foreground">
                Please select a user from the dropdown above to manage their inventory
              </p>
            </div>
          ) : (
            <AdminInventoryManagement 
              selectedUser={selectedUser}
              inventory={inventory}
              shipped={shipped}
              loading={inventoryLoading}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
