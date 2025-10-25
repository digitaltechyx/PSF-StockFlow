"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCollection } from "@/hooks/use-collection";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, User, Calendar, Phone, Mail, Eye, Trash2, UserCheck, RotateCcw, Search, X } from "lucide-react";
import { format } from "date-fns";
import type { UserProfile } from "@/types";

interface MemberManagementProps {
  adminUser: UserProfile | null;
}

export function MemberManagement({ adminUser }: MemberManagementProps) {
  const { data: users, loading } = useCollection<UserProfile>("users");
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter users excluding admin and apply search
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const isNotAdmin = user.uid !== adminUser?.uid;
      const matchesSearch = searchQuery === "" || 
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone?.toLowerCase().includes(searchQuery.toLowerCase());
      return isNotAdmin && matchesSearch;
    });
  }, [users, adminUser, searchQuery]);

  // Separate users by status
  const pendingUsers = filteredUsers.filter((user) => user.status === "pending");
  const approvedUsers = filteredUsers.filter((user) => user.status === "approved" || !user.status);
  const deletedUsers = filteredUsers.filter((user) => user.status === "deleted");

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
        description: `User "${user.name}" has been moved to deleted members!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user.",
      });
    }
  };

  const handleRestoreUser = async (user: UserProfile) => {
    try {
      // Restore user by changing status back to approved
      await updateDoc(doc(db, "users", user.uid), {
        status: "approved",
        approvedAt: new Date(),
        deletedAt: null,
      });

      toast({
        title: "Success",
        description: `User "${user.name}" has been restored successfully!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to restore user.",
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

  const UserCard = ({ user, showActions = false, showRestore = false, isAdmin = false }: { user: UserProfile; showActions?: boolean; showRestore?: boolean; isAdmin?: boolean }) => (
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
                <Badge 
                  variant={
                    user.status === "approved" || !user.status ? "default" : 
                    user.status === "pending" ? "secondary" : "destructive"
                  } 
                  className="text-xs"
                >
                  {user.status === "approved" || !user.status ? "Approved" : 
                   user.status === "pending" ? "Pending" : "Deleted"}
                </Badge>
                {user.phone && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {user.phone}
                  </span>
                )}
                {user.deletedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Deleted: {formatDate(user.deletedAt)}
                  </span>
                )}
                {isAdmin && (user.status === "approved" || !user.status) && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Login Credentials:</div>
                    <div className="text-xs flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span className="font-mono">{user.email}</span>
                    </div>
                    <div className="text-xs flex items-center gap-1 mt-1">
                      <span className="text-muted-foreground">Password:</span>
                      <span className="font-mono">{user.password || "Password not stored (created before update)"}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                <p>View user details</p>
              </TooltipContent>
            </Tooltip>
            {showActions && (
              <>
                {user.status === "pending" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApproveUser(user)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Approve user account</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleDeleteUser(user)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {showRestore && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreUser(user)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Restore user account</p>
                </TooltipContent>
              </Tooltip>
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
    <TooltipProvider>
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
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Pending Members ({pendingUsers.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved Members ({approvedUsers.length})
            </TabsTrigger>
            <TabsTrigger value="deleted" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Deleted Members ({deletedUsers.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="space-y-4 mt-6">
            {pendingUsers.length > 0 ? (
              <div className="space-y-3">
                {pendingUsers.map((user, index) => (
                  <UserCard key={user.uid || `pending-user-${index}`} user={user} showActions={true} isAdmin={adminUser?.role === "admin"} />
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
                {approvedUsers.map((user, index) => (
                  <UserCard key={user.uid || `user-${index}`} user={user} showActions={true} isAdmin={adminUser?.role === "admin"} />
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
          
          <TabsContent value="deleted" className="space-y-4 mt-6">
            {deletedUsers.length > 0 ? (
              <div className="space-y-3">
                {deletedUsers.map((user, index) => (
                  <UserCard key={user.uid || `deleted-user-${index}`} user={user} showRestore={true} isAdmin={adminUser?.role === "admin"} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Deleted Members</h3>
                <p className="text-muted-foreground">
                  No users have been deleted yet.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}

