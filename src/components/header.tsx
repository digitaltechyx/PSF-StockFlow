"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Logo } from "./logo";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface HeaderProps {
  onProfileClick?: () => void;
  sidebarTrigger?: React.ReactNode;
}

export function Header({ onProfileClick, sidebarTrigger }: HeaderProps) {
  const { signOut, userProfile } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleProfileClick = () => {
    if (onProfileClick) {
      onProfileClick();
    } else {
      // Dispatch custom event for dashboard page
      window.dispatchEvent(new Event('toggle-profile'));
    }
  };
  
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 sm:h-14 items-center gap-2 sm:gap-4 border-b bg-background px-2 sm:px-4 md:px-6">
      <div className="flex items-center gap-1 sm:gap-4 min-w-0 flex-1">
        {sidebarTrigger}
        <Logo />
      </div>
      <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
        <span className="hidden sm:block text-xs sm:text-sm font-medium truncate max-w-24">
          {userProfile?.name}
        </span>
        <span className="sm:hidden text-xs font-medium truncate">
          {userProfile?.name?.split(' ')[0]}
        </span>
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
          <AvatarImage src={`https://avatar.vercel.sh/${userProfile?.email}.png`} alt={userProfile?.name || 'User'} />
          <AvatarFallback className="text-xs">{getInitials(userProfile?.name)}</AvatarFallback>
        </Avatar>
        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-9 sm:w-9" onClick={handleProfileClick}>
          <UserIcon className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="sr-only">Profile</span>
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-9 sm:w-9" onClick={handleSignOut}>
          <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>
    </header>
  );
}
