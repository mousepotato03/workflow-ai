"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, User, Loader2 } from "lucide-react";
import { GoogleIcon } from "@/components/ui/google-icon";

export default function LoginButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">세션 확인 중...</span>
      </div>
    );
  }

  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.user_metadata?.avatar_url || ""}
                alt={user.user_metadata?.full_name || ""}
              />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex items-center gap-2 p-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user.user_metadata?.avatar_url || ""}
                alt={user.user_metadata?.full_name || ""}
              />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm font-medium">
                {user.user_metadata?.full_name || "사용자"}
              </p>
              <p className="text-xs text-muted-foreground">로그인됨</p>
            </div>
          </div>
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={signingIn}
      variant="outline"
      size="lg"
      className="gap-3 px-6 py-3 h-12 bg-card hover:bg-muted border border-border hover:border-muted-foreground text-foreground font-medium shadow-sm"
    >
      {signingIn ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <GoogleIcon size={20} />
      )}
      {signingIn ? "로그인 중..." : "Sign in with Google"}
    </Button>
  );
}
