"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, Zap } from "lucide-react";
import type { UserProfile, UserRole, UserFeature } from "@/types";
import { getUserRoles } from "@/lib/permissions";
import { generateUniqueReferralCode } from "@/lib/commission-utils";

interface RoleFeatureManagementProps {
  user: UserProfile;
  onSuccess?: () => void;
}

const ALL_ROLES: UserRole[] = ["user", "commission_agent"];
const ALL_FEATURES: { value: UserFeature; label: string; description: string }[] = [
  { value: "buy_labels", label: "Buy Labels", description: "Access to purchase labels" },
  { value: "upload_labels", label: "Upload Labels", description: "Upload shipping labels" },
  { value: "track_shipment", label: "Track Shipment", description: "Track shipment status" },
  { value: "view_invoices", label: "View Invoices", description: "View and manage invoices" },
  { value: "restock_summary", label: "Restock Summary", description: "View restock history" },
  { value: "delete_logs", label: "Delete Logs", description: "View deletion history" },
  { value: "modification_logs", label: "Modification Logs", description: "View edit history" },
  { value: "disposed_inventory", label: "Disposed Inventory", description: "View disposed items" },
  { value: "affiliate_dashboard", label: "Affiliate Dashboard", description: "Access affiliate/commission dashboard" },
];

export function RoleFeatureManagement({ user, onSuccess }: RoleFeatureManagementProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Get current roles (support both legacy and new format)
  const currentRoles = getUserRoles(user);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(currentRoles);
  
  // Get current features
  const currentFeatures = user.features || [];
  const [selectedFeatures, setSelectedFeatures] = useState<UserFeature[]>(currentFeatures);

  const handleRoleToggle = (role: UserRole) => {
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleFeatureToggle = (feature: UserFeature) => {
    setSelectedFeatures((prev) => {
      if (prev.includes(feature)) {
        return prev.filter((f) => f !== feature);
      } else {
        return [...prev, feature];
      }
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData: any = {
        roles: selectedRoles,
        features: selectedFeatures,
      };

      // Check if commission_agent role is being added (wasn't in current roles, but is in selected roles)
      const hadCommissionAgentRole = currentRoles.includes("commission_agent");
      const hasCommissionAgentRole = selectedRoles.includes("commission_agent");
      const isAddingCommissionAgentRole = !hadCommissionAgentRole && hasCommissionAgentRole;

      // If commission_agent role is being added, generate a NEW referral code
      // (always generate new, even if they had one before - per user requirement)
      if (isAddingCommissionAgentRole) {
        const referralCode = await generateUniqueReferralCode(
          user.name || "AGENT",
          user.uid
        );
        updateData.referralCode = referralCode;
      }

      // If commission_agent role is being removed, we can optionally clear the referral code
      // But we'll keep it for historical purposes (in case they get access back later)
      // The user requirement says to generate NEW code when access is restored, so we don't clear it

      // If user has no roles, keep legacy role for backward compatibility
      if (selectedRoles.length === 0) {
        updateData.role = user.role || "user";
      } else {
        // Set primary role as legacy role for backward compatibility
        updateData.role = selectedRoles[0];
      }

      await updateDoc(doc(db, "users", user.uid), updateData);

      const successMessage = isAddingCommissionAgentRole
        ? `Roles and features updated successfully. New referral code: ${updateData.referralCode}`
        : "Roles and features have been updated successfully.";

      toast({
        title: "Success",
        description: successMessage,
      });

      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update roles and features.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = 
    JSON.stringify(selectedRoles.sort()) !== JSON.stringify(currentRoles.sort()) ||
    JSON.stringify(selectedFeatures.sort()) !== JSON.stringify(currentFeatures.sort());

  return (
    <div className="space-y-6">
      {/* Roles Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>User Roles</CardTitle>
          </div>
          <CardDescription>
            Assign one or multiple roles to this user. Users with multiple roles will have access to all corresponding dashboards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ALL_ROLES.map((role) => {
            const isSelected = selectedRoles.includes(role);
            return (
              <div
                key={role}
                className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  id={`role-${role}`}
                  checked={isSelected}
                  onCheckedChange={() => handleRoleToggle(role)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor={`role-${role}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {role === "user" ? "Client/User" : "Commission Agent"}
                      {isSelected && (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {role === "user"
                      ? "Access to client dashboard with inventory management, shipments, and invoices"
                      : "Access to affiliate dashboard with referral code, clients, and commissions"}
                  </p>
                </div>
              </div>
            );
          })}
          {selectedRoles.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              ⚠️ User must have at least one role. Select a role to continue.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Features Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>Feature Access</CardTitle>
          </div>
          <CardDescription>
            Grant specific feature access to this user. Features can be assigned to any role (clients or commission agents). 
            For example, you can grant "Buy Labels" to a commission agent even if they don't have the "user" role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ALL_FEATURES.map((feature) => {
              const isSelected = selectedFeatures.includes(feature.value);
              return (
                <div
                  key={feature.value}
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    id={`feature-${feature.value}`}
                    checked={isSelected}
                    onCheckedChange={() => handleFeatureToggle(feature.value)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={`feature-${feature.value}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {feature.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={isLoading || selectedRoles.length === 0 || !hasChanges}
          className="min-w-[120px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

