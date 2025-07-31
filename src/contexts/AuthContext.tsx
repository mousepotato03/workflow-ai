"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthContextType, User } from "@/types/auth";
import type { Session } from "@supabase/supabase-js";

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const createUserProfile = useCallback(async (userId: string, authUser: any): Promise<User | null> => {
    const { data, error } = await supabase
      .from("users")
      .insert({
        id: userId,
        full_name: authUser.user_metadata?.full_name || "",
        avatar_url: authUser.user_metadata?.avatar_url || "",
      })
      .select()
      .single();

    return error ? null : data;
  }, [supabase]);

  const fetchUserProfile = useCallback(async (userId: string, authUser: any): Promise<User | null> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    console.log("data", data);
    console.log("error", error);

    if (data) return data;
    
    if (error?.code === "PGRST116") {
      return await createUserProfile(userId, authUser);
    }
    
    return null;
  }, [supabase, createUserProfile]);

  const handleSessionChange = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      return;
    }

    const userProfile = await fetchUserProfile(session.user.id, session.user);
    setUser(userProfile);
  }, [fetchUserProfile]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      console.log("initializeAuth");
      const { data: { session } } = await supabase.auth.getSession();
      console.log("session", session);
      
      if (mounted) {
        await handleSessionChange(session);
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        await handleSessionChange(session);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [handleSessionChange, supabase.auth]);

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
      },
    });

    if (error) throw error;
  };

  const signOut = async () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("returnUrl");
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
