"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleIcon } from "@/components/ui/google-icon";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<string>("처리 중...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus("불러오는 중...");

        // Handle the OAuth callback
        console.log("getSession 진입");
        const { data, error } = await supabase.auth.getSession();
        console.log("data", data);
        console.log("error", error);

        if (error) {
          setStatus("인증 실패");
          setTimeout(() => {
            router.push("/?error=auth_failed");
          }, 2000);
          return;
        }

        if (data.session) {
          setStatus("로그인 성공! 페이지로 이동 중...");

          // 약간의 지연을 주어 AuthContext가 세션을 처리할 시간을 줌
          setTimeout(() => {
            // 이전 페이지로 리다이렉션 (로그인 전 페이지)
            const returnUrl = sessionStorage.getItem("returnUrl");
            if (
              returnUrl &&
              returnUrl !== window.location.href &&
              !returnUrl.includes("/auth/callback")
            ) {
              sessionStorage.removeItem("returnUrl");
              router.push(returnUrl);
            } else {
              // 기본 페이지로 이동
              router.push("/");
            }
          }, 1500);
        } else {
          setStatus("세션을 찾을 수 없습니다. 홈페이지로 이동 중...");
          setTimeout(() => {
            router.push("/");
          }, 2000);
        }
      } catch (error) {
        setStatus("오류 발생. 홈페이지로 이동 중...");
        setTimeout(() => {
          router.push("/?error=unexpected");
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="w-full max-w-md px-4">
        <div className="bg-slate-900 rounded-2xl shadow-2xl p-8 border border-slate-800">
          <div className="flex flex-col items-center space-y-8">
            {/* Google 아이콘 */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 border border-slate-700 shadow mb-2">
              <GoogleIcon size={32} />
            </div>
            {/* 상태 메시지 및 로딩 */}
            <div className="w-full flex flex-col items-center space-y-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                로그인 처리 중
              </h2>
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-base text-slate-300">{status}</span>
              </div>
              {/* 진행 표시줄 */}
              <div className="w-full mt-2">
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse rounded-full" />
                </div>
              </div>
            </div>
            {/* 안내 문구 */}
            <p className="text-sm text-slate-400 text-center mt-4">
              인증이 완료되면 자동으로 이동합니다.
              <br />
              문제가 지속되면 새로고침 해주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
