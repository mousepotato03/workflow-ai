"use client";

import { useEffect, useState, Suspense } from "react";
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

function LoginRequiredModalContent() {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setIsOpen(true);
      switch (error) {
        case "auth_failed":
          setErrorMessage("Login failed. Please try again.");
          break;
        case "unexpected":
          setErrorMessage(
            "An unexpected error occurred. Please try again."
          );
          break;
        default:
          setErrorMessage("An error occurred during login. Please try again.");
      }
    }
  }, [searchParams]);

  const handleClose = () => {
    setIsOpen(false);
    // Use window.location only on client side
    if (typeof window !== 'undefined') {
      // Remove error parameter from URL
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
            Login Error
          </DialogTitle>
          <DialogDescription className="text-left">
            {errorMessage}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button onClick={handleClose}>Try Again</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LoginRequiredModal() {
  return (
    <Suspense fallback={null}>
      <LoginRequiredModalContent />
    </Suspense>
  );
}
