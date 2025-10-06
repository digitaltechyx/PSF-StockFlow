"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCollection } from "@/hooks/use-collection";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, User, Calendar, Phone, Mail, Eye, Trash2, UserCheck } from "lucide-react";
import { format } from "date-fns";
import type { UserProfile } from "@/types";

interface MemberManagementProps {
  adminUser: UserProfile | null;
}

export function MemberManagement({ adminUser }: MemberManagementProps) {
  const { data: users, loading } = useCollection<UserProfile>("users");
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Filter users excluding admin and deleted users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => 
      user.uid !== adminUser?.uid && user.status !== "deleted"
    );
  }, [users, adminUser]);

  // Separate pending and approved users
  const pendingUsers = filteredUsers.filter((user) => user.status === "pending");
  const approvedUsers = filteredUsers.filter((user) => user.status === "approved");

  const handleApproveUser = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, "users", user.uid), {
        status: "approved",
        approvedAt: new Date(),
      });

      toast({
        title: "Success",
        description: `User "${user.name}" has been approved!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to approve user.",
      });
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    try {
      // Mark user as deleted in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        status: "deleted",
        deletedAt: new Date(),
      });

      toast({
        title: "Success",
        description: `User "${user.name}" has been deleted!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user.",
      });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: any) => {
    if (!date) return "N/A";
    
    try {
      let dateObj: Date;
      
      // Handle Firestore timestamp
      if (date && typeof date === 'object' && date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      }
      // Handle regular Date object
      else if (date instanceof Date) {
        dateObj = date;
      }
      // Handle string or number
      else {
        dateObj = new Date(date);
      }
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        return "N/A";
      }
      
      return format(dateObj, "MMM dd, yyyy");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  const UserCard = ({ user, showActions = false }: { user: UserProfile; showActions?: boolean }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={`https://avatar.vercel.sh/${user.email}.png`} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-sm">{user.name}</h3>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={user.status === "approved" ? "default" : "secondary"} className="text-xs">
                  {user.status === "approved" ? "Approved" : "Pending"}
                </Badge>
                {user.phone && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {user.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>User Details</DialogTitle>
                  <DialogDescription>
                    Complete information about this user.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={`https://avatar.vercel.sh/${user.email}.png`} />
                      <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Role:</span>
                      <p className="text-muted-foreground capitalize">{user.role}</p>
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>
                      <p className="text-muted-foreground capitalize">{user.status}</p>
                    </div>
                    <div>
                      <span className="font-medium">Phone:</span>
                      <p className="text-muted-foreground">{user.phone || "N/A"}</p>
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>
                      <p className="text-muted-foreground">{formatDate(user.createdAt)}</p>
                    </div>
                    {user.approvedAt && (
                      <div>
                        <span className="font-medium">Approved:</span>
                        <p className="text-muted-foreground">{formatDate(user.approvedAt)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {showActions && (
              <>
                {user.status === "pending" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleApproveUser(user)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <UserCheck className="h-4 w-4" />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete User Account</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{user.name}"? This action cannot be undone.
                        The user will no longer be able to access the system.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteUser(user)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete User
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Member Management</CardTitle>
          <CardDescription>Loading members...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Member Management
        </CardTitle>
        <CardDescription>
          Manage user approvals and view member details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Pending Members ({pendingUsers.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved Members ({approvedUsers.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4 mt-6">
            {pendingUsers.length > 0 ? (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <UserCard key={user.uid} user={user} showActions={true} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Pending Members</h3>
                <p className="text-muted-foreground">
                  All users have been processed.
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="approved" className="space-y-4 mt-6">
            {approvedUsers.length > 0 ? (
              <div className="space-y-3">
                {approvedUsers.map((user) => (
                  <UserCard key={user.uid} user={user} showActions={true} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Approved Members</h3>
                <p className="text-muted-foreground">
                  No users have been approved yet.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

