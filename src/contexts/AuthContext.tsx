"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthContextType, User } from "@/types/auth";
import type { AuthError, Session } from "@supabase/supabase-js";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
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
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          await handleSessionChange(session);
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        try {
          await handleSessionChange(session);
          // 인증 상태 변경 시에는 이미 초기화가 완료된 상태이므로 loading을 false로 설정
          if (loading) {
            setLoading(false);
          }
        } catch (error) {
          setUser(null);
          if (loading) {
            setLoading(false);
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 인증이 필요한 페이지에서
  useEffect(() => {
    if (!user && !loading) {
      // 로그인이 필요한 상태에서 현재 페이지 저장
      sessionStorage.setItem("returnUrl", window.location.href);
    }
  }, [user, loading]);

  // 사용자 프로필 조회 재시도 로직
  const fetchUserProfileWithRetry = async (
    userId: string,
    authUser: any,
    maxRetries = 3
  ): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Supabase 연결 상태 디버깅
        const { data: sessionData } = await supabase.auth.getSession();

        // 간단한 연결 테스트
        const { data: testData, error: testError } = await supabase
          .from("users")
          .select("count")
          .limit(1);

        // 직접 쿼리 실행 (타임아웃 제거하여 실제 문제 확인)
        const { data: userProfile, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (userProfile) {
          return userProfile;
        }

        if (profileError?.code === "PGRST116") {
          // 프로필이 없는 경우 - 신규 사용자일 가능성
          if (attempt === 1) {
            // 첫 번째 시도에서 프로필이 없으면 트리거가 아직 실행되지 않았을 수 있음
            await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기
            continue;
          } else if (attempt === maxRetries) {
            // 마지막 시도에서도 프로필이 없으면 수동 생성
            return await createUserProfile(userId, authUser);
          } else {
            // 중간 시도에서는 잠시 더 대기
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }
        } else {
          // 기타 데이터베이스 에러
          if (attempt === maxRetries) {
            return null;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        if (error.message === "TIMEOUT") {
          if (attempt === maxRetries) {
            return await createUserProfile(userId, authUser);
          }
        } else {
          if (attempt === maxRetries) {
            return await createUserProfile(userId, authUser);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return null;
  };

  // 사용자 프로필 수동 생성
  const createUserProfile = async (userId: string, authUser: any) => {
    try {
      const { data: newProfile, error: createError } = await supabase
        .from("users")
        .insert({
          id: userId,
          full_name: authUser.user_metadata?.full_name || "",
          avatar_url: authUser.user_metadata?.avatar_url || "",
        })
        .select()
        .single();

      if (createError) {
        return null;
      }

      return newProfile;
    } catch (error) {
      return null;
    }
  };

  const handleSessionChange = async (session: Session | null) => {
    if (session?.user) {
      try {
        // 사용자 프로필 조회 (재시도 로직 포함)
        const userProfile = await fetchUserProfileWithRetry(
          session.user.id,
          session.user
        );

        if (userProfile) {
          setUser(userProfile);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  const signInWithGoogle = async () => {
    try {
      // 현재 페이지 URL을 저장 (로그인 후 돌아올 페이지)
      if (typeof window !== "undefined") {
        const currentUrl = window.location.href;
        sessionStorage.setItem("returnUrl", currentUrl);
      }

      // 클라이언트 사이드에서만 window.location 사용
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : "/auth/callback";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // 저장된 returnUrl 제거
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("returnUrl");
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
