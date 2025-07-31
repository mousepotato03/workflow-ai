"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";

interface CenteredLoginSectionProps {
  title?: string;
  description?: string;
  showTerms?: boolean;
  className?: string;
}

export default function CenteredLoginSection({
  title = "Unlock all features",
  description = "Sign in to like, review, and contribute to the community.",
  showTerms = true,
  className = "",
}: CenteredLoginSectionProps) {
  const { signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      await signInWithGoogle();
    } catch (error) {
      // Handle login error silently
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-center space-y-8 ${className}`}
    >
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-lg text-muted-foreground max-w-md">{description}</p>
      </div>

      <div className="flex flex-col items-center space-y-6">
        <Button
          onClick={handleSignIn}
          disabled={signingIn}
          size="lg"
          className="gap-3 px-8 py-4 h-14 bg-card hover:bg-muted border border-border hover:border-muted-foreground text-foreground font-medium shadow-sm text-base"
        >
          <GoogleIcon size={24} />
          {signingIn ? "로그인 중..." : "Sign in with Google"}
        </Button>

        {showTerms && (
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            By continuing, you agree to our{" "}
            <a href="/terms" className="text-primary hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
