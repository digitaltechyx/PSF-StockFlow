"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { reauthenticateWithCredential, updatePassword, EmailAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { User, Lock, Phone, Building2, Hash, MapPin, Mail, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ProfileSection() {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [phone, setPhone] = useState(userProfile?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdatePhone = async () => {
    if (!phone.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid Phone",
        description: "Phone number cannot be empty.",
      });
      return;
    }

    if (!userProfile) return;

    try {
      setIsLoading(true);
      await updateDoc(doc(db, "users", userProfile.uid), {
        phone: phone.trim(),
      });

      toast({
        title: "Success",
        description: "Phone number updated successfully!",
      });

      setIsEditingPhone(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update phone number.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validatePassword = (): boolean => {
    const errors: string[] = [];

    if (!currentPassword) {
      errors.push("Current password is required");
    }

    if (!newPassword) {
      errors.push("New password is required");
    } else {
      if (newPassword.length < 6) {
        errors.push("New password must be at least 6 characters");
      }
    }

    if (!confirmPassword) {
      errors.push("Please confirm your new password");
    } else if (newPassword !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    if (newPassword && currentPassword && newPassword === currentPassword) {
      errors.push("New password must be different from current password");
    }

    setPasswordErrors(errors);
    return errors.length === 0;
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) {
      return;
    }

    if (!user || !user.email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User not authenticated properly.",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Re-authenticate the user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Sync the updated password to user's Firestore document for admin visibility
      await updateDoc(doc(db, "users", user.uid), {
        password: newPassword,
      });

      // Clear fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsChangingPassword(false);
      setPasswordErrors([]);

      toast({
        title: "Success",
        description: "Password updated successfully!",
      });
    } catch (error: any) {
      let errorMessage = "Failed to update password.";
      
      if (error.code === "auth/wrong-password") {
        errorMessage = "Current password is incorrect.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "New password is too weak.";
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Please log out and log back in before changing your password.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        variant: "destructive",
        title: "Password Change Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5" />
          <CardTitle>Profile Settings</CardTitle>
        </div>
        <CardDescription>Manage your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Information - Read Only */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="email">Email</Label>
            </div>
            <Input
              id="email"
              type="email"
              value={userProfile?.email || "N/A"}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="name">Full Name</Label>
            </div>
            <Input
              id="name"
              type="text"
              value={userProfile?.name || "N/A"}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="companyName">Company Name</Label>
            </div>
            <Input
              id="companyName"
              type="text"
              value={userProfile?.companyName || "N/A"}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="ein">EIN</Label>
            </div>
            <Input
              id="ein"
              type="text"
              value={userProfile?.ein || "N/A"}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="address">Address</Label>
            </div>
            <Input
              id="address"
              type="text"
              value={userProfile?.address || "N/A"}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                type="text"
                value={userProfile?.city || "N/A"}
                disabled
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                type="text"
                value={userProfile?.state || "N/A"}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              type="text"
              value={userProfile?.country || "N/A"}
              disabled
              className="bg-muted"
            />
          </div>

          <div>
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input
              id="zipCode"
              type="text"
              value={userProfile?.zipCode || "N/A"}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        {/* Phone Number Section */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <Label>Phone Number</Label>
          </div>

          {!isEditingPhone ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {userProfile?.phone || "No phone number set"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingPhone(true)}
              >
                Edit
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                type="tel"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleUpdatePhone}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingPhone(false);
                    setPhone(userProfile?.phone || "");
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Password Change Section */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <Label>Password</Label>
          </div>

          {!isChangingPassword ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">••••••••</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsChangingPassword(true);
                  setPasswordErrors([]);
                }}
              >
                Change Password
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {passwordErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {passwordErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={isLoading}
                >
                  {isLoading ? "Changing..." : "Change Password"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordErrors([]);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


