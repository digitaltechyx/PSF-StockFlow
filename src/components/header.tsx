"use client";

import { LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Logo } from "./logo";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function Header() {
  const { signOut, userProfile } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };
  
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <div className="flex items-center gap-4">
        <Logo />
      </div>
      <div className="ml-auto flex items-center gap-4">
        <span className="text-sm font-medium">{userProfile?.name}</span>
         <Avatar>
            <AvatarImage src={`https://avatar.vercel.sh/${userProfile?.email}.png`} alt={userProfile?.name || 'User'} />
            <AvatarFallback>{getInitials(userProfile?.name)}</AvatarFallback>
          </Avatar>
        <Button variant="outline" size="icon" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>
    </header>
  );
}
