"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userProfile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || userProfile?.role !== "admin") {
        router.replace("/login");
      }
    }
  }, [user, userProfile, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "A";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  if (loading || !user || userProfile?.role !== "admin") {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-12 sm:h-14 md:h-16 items-center gap-2 sm:gap-4 border-b bg-background px-2 sm:px-4 md:px-6">
        <div className="flex items-center gap-1 sm:gap-2 md:gap-4 min-w-0 flex-1">
          <Logo />
          <h1 className="hidden sm:block sm:text-lg md:text-xl font-bold font-headline truncate">
            Admin Dashboard
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2 md:gap-4 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
            <Avatar className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8">
              <AvatarImage src={`https://avatar.vercel.sh/${userProfile?.email}.png`} />
              <AvatarFallback className="text-xs">{getInitials(userProfile?.name)}</AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs sm:text-sm font-semibold truncate max-w-20 lg:max-w-none">
                {userProfile?.name}
              </span>
              <span className="text-xs text-muted-foreground">Administrator</span>
            </div>
            <div className="sm:hidden text-xs">
              <span className="font-semibold">{userProfile?.name?.split(' ')[0]}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-auto px-2 sm:px-3 flex-shrink-0" onClick={handleSignOut}>
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-2 sm:p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
