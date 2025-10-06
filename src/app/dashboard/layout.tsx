"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Header } from "@/components/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userProfile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (userProfile?.role !== "user") {
        // Redirect if not a regular user, e.g., an admin trying to access user dash
        router.replace("/admin/dashboard");
      } else if (userProfile?.status === "pending") {
        // Redirect pending users to a waiting page
        router.replace("/pending-approval");
      } else if (userProfile?.status === "deleted") {
        // Sign out deleted users
        signOut();
        router.replace("/login");
      }
    }
  }, [user, userProfile, loading, router]);

  if (loading || !user || userProfile?.role !== "user" || userProfile?.status === "pending" || userProfile?.status === "deleted") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="flex flex-1 flex-col gap-2 sm:gap-4 md:gap-8 p-2 sm:p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
