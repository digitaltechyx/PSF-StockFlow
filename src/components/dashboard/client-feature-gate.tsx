"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { hasRole, hasFeature } from "@/lib/permissions";
import { getRequiredFeatureForPath } from "@/lib/dashboard-routes";
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

export function ClientFeatureGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userProfile } = useAuth();
  const requiredFeature = getRequiredFeatureForPath(pathname);

  // No feature required for this path
  if (!requiredFeature) {
    return <>{children}</>;
  }

  // Super admin always has access
  if (userProfile && hasRole(userProfile, "admin")) {
    return <>{children}</>;
  }

  // Commission agent: gate by affiliate_dashboard
  if (requiredFeature === "affiliate_dashboard") {
    if (userProfile && hasFeature(userProfile, "affiliate_dashboard")) {
      return <>{children}</>;
    }
    return <LockedOverlay />;
  }

  // Client (user): only allow if they have this feature in their assigned list
  const hasAccess = userProfile && hasFeature(userProfile, requiredFeature);
  if (hasAccess) {
    return <>{children}</>;
  }

  // No access: show only the overlay (do not render page content)
  return <LockedOverlay />;
}
