"use client";

import { createContext, useContext } from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const supabase = createClient();

  const signInWithGoogle = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("returnUrl", window.location.href);
    }

    const redirectUrl = typeof window !== "undefined" 
      ? `${window.location.origin}/auth/callback`
      : "/auth/callback";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) throw error;
  };

  const signOut = async () => {
    let currentUrl = "/";
    
    if (typeof window !== "undefined") {
      currentUrl = window.location.href;
      sessionStorage.removeItem("returnUrl");
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // 로그아웃 후 현재 페이지로 리다이렉트 (새로고침 효과)
    window.location.href = currentUrl;
  };

  const value: AuthContextType = {
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
