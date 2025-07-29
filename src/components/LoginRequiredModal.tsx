"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";

export function LoginRequiredModal() {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setIsOpen(true);
      switch (error) {
        case "auth_failed":
          setErrorMessage("로그인에 실패했습니다. 다시 시도해주세요.");
          break;
        case "unexpected":
          setErrorMessage(
            "예상치 못한 오류가 발생했습니다. 다시 시도해주세요."
          );
          break;
        default:
          setErrorMessage("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    }
  }, [searchParams]);

  const handleClose = () => {
    setIsOpen(false);
    // 클라이언트 사이드에서만 window.location 사용
    if (typeof window !== 'undefined') {
      // URL에서 error 파라미터 제거
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            로그인 오류
          </DialogTitle>
          <DialogDescription className="text-left">
            {errorMessage}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleClose}>
            닫기
          </Button>
          <Button onClick={handleClose}>다시 시도</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
