"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { hasRole } from "@/lib/permissions";

export default function Home() {
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && userProfile) {
        const userStatus = userProfile.status || "approved";
        
        if (userStatus === "deleted") {
          router.replace("/login");
        } else if (userStatus === "pending") {
          router.replace("/pending-approval");
        } else if (hasRole(userProfile, 'admin') || hasRole(userProfile, 'sub_admin')) {
          // ALWAYS prioritize admin/sub_admin dashboard if user has that role
          // Even if they have other roles, admin dashboard should be the default
          router.replace("/admin/dashboard");
        } else {
          router.replace("/dashboard");
        }
      } else {
        router.replace("/login");
      }
    }
  }, [user, userProfile, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}

