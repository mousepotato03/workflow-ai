"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "@/components/ui/google-icon";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<string>("인증 처리 중...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus("OAuth 콜백 처리 중...");

        // URL에서 코드와 상태 파라미터 확인 (클라이언트 사이드에서만)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error_code = urlParams.get('error');
        const error_description = urlParams.get('error_description');

        // OAuth 에러 처리
        if (error_code) {
          console.error("OAuth error:", error_code, error_description);
          setError(`인증 실패: ${error_description || error_code}`);
          setStatus("인증 실패");
          setTimeout(() => {
            router.push("/?error=oauth_error");
          }, 3000);
          return;
        }

        // 코드가 없는 경우
        if (!code) {
          setError("인증 코드를 찾을 수 없습니다.");
          setStatus("인증 실패");
          setTimeout(() => {
            router.push("/?error=no_code");
          }, 3000);
          return;
        }

        setStatus("세션 생성 중...");

        // Supabase가 자동으로 세션을 처리하도록 기다림
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 현재 세션 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        let data, exchangeError;
        
        if (session) {
          data = { session, user: session.user };
          exchangeError = null;
        } else {
          // 세션이 없으면 수동으로 code 교환 시도
          try {
            const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
            data = sessionData;
            exchangeError = error;
          } catch (err) {
            exchangeError = err;
            data = null;
          }
        }

        if (exchangeError) {
          console.error("Exchange code error:", exchangeError);
          setError(`세션 생성 실패: ${exchangeError.message}`);
          setStatus("인증 실패");
          setTimeout(() => {
            router.push("/?error=session_failed");
          }, 3000);
          return;
        }

        if (data.session && data.user) {
          setStatus("로그인 성공! 리다이렉트 중...");
          
          // AuthContext가 세션 변경을 감지하고 사용자 프로필을 처리할 시간을 줌
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 리다이렉트 처리
          const returnUrl = sessionStorage.getItem("returnUrl");
          
          if (
            returnUrl && 
            returnUrl !== window.location.href &&
            !returnUrl.includes("/auth/callback") &&
            !returnUrl.includes("error=")
          ) {
            sessionStorage.removeItem("returnUrl");
            setStatus("이전 페이지로 이동 중...");
            router.push(returnUrl);
          } else {
            setStatus("홈페이지로 이동 중...");
            router.push("/");
          }
        } else {
          setError("세션 또는 사용자 정보를 찾을 수 없습니다.");
          setStatus("인증 실패");
          setTimeout(() => {
            router.push("/?error=no_session");
          }, 3000);
        }
      } catch (error: any) {
        console.error("Auth callback error:", error);
        setError(`예기치 못한 오류: ${error.message || "알 수 없는 오류"}`);
        setStatus("오류 발생");
        setTimeout(() => {
          router.push("/?error=unexpected");
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md px-4">
        <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border">
          <div className="flex flex-col items-center space-y-8">
            {/* Google 아이콘 */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted border border-border shadow mb-2">
              <GoogleIcon size={32} />
            </div>
            {/* 상태 메시지 및 로딩 */}
            <div className="w-full flex flex-col items-center space-y-4">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                {error ? "인증 오류" : "로그인 처리 중"}
              </h2>
              <div className="flex items-center space-x-2">
                {!error && <Loader2 className="h-6 w-6 animate-spin text-blue-500" />}
                {error && <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">!</span>
                </div>}
                <span className={`text-base ${error ? 'text-red-300' : 'text-muted-foreground'}`}>
                  {status}
                </span>
              </div>
              {/* 진행 표시줄 또는 에러 메시지 */}
              {!error && (
                <div className="w-full mt-2">
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse rounded-full" />
                  </div>
                </div>
              )}
              {error && (
                <div className="w-full p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-300 text-center">{error}</p>
                </div>
              )}
            </div>
            {/* 안내 문구 */}
            <p className="text-sm text-muted-foreground text-center mt-4">
              {error 
                ? "잠시 후 홈페이지로 이동합니다. 문제가 지속되면 다시 시도해주세요."
                : "인증이 완료되면 자동으로 이동합니다."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
