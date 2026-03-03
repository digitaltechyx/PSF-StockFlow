"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { hasRole, hasFeature, getDefaultFeaturesForRole } from "@/lib/permissions";
import { getRequiredFeatureForPath } from "@/lib/dashboard-routes";
import type { UserFeature } from "@/types";
import { Lock } from "lucide-react";

function LockedOverlay() {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 rounded-lg border border-border/50 bg-muted/30 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Unlock</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Contact with the admin to unlock this feature for your account.
        </p>
      </div>
    </div>
  );
}

/** Strict check: for role "user", allow only if requiredFeature is in their features array (or default list if no array). */
function userHasFeature(
  features: UserFeature[] | undefined | null,
  roles: string[],
  requiredFeature: UserFeature
): boolean {
  const isUser = roles.includes("user");
  if (!isUser) return false;
  const list = Array.isArray(features) ? features : [];
  if (list.length > 0) {
    return list.includes(requiredFeature);
  }
  return getDefaultFeaturesForRole("user").includes(requiredFeature);
}

export function ClientFeatureGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userProfile } = useAuth();

  // Normalize path (no trailing slash) so it matches route config
  const path = (pathname ?? "").replace(/\/$/, "") || "/";
  const requiredFeature = getRequiredFeatureForPath(path);

  if (!requiredFeature) {
    return <>{children}</>;
  }

  if (userProfile && hasRole(userProfile, "admin")) {
    return <>{children}</>;
  }

  if (requiredFeature === "affiliate_dashboard") {
    if (userProfile && hasFeature(userProfile, "affiliate_dashboard")) {
      return <>{children}</>;
    }
    return <LockedOverlay />;
  }

  // Client (user) route: strict check using profile.features and profile.roles directly
  const roles = (userProfile?.roles && Array.isArray(userProfile.roles)
    ? userProfile.roles
    : userProfile?.role
      ? [userProfile.role]
      : []) as string[];
  const features = userProfile?.features;

  const hasAccess =
    userProfile &&
    userHasFeature(features, roles, requiredFeature);

  if (hasAccess) {
    return <>{children}</>;
  }

  return <LockedOverlay />;
}
