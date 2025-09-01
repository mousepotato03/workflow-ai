"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GitBranch } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import LoginButton from "@/components/LoginButton";
import { useWorkflowStore } from "@/features/workflow/hooks/useWorkflowStore";
import { useCanvasStore } from "@/stores/useCanvasStore";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

const navigationItems = [
  { name: "Home", href: "/" },
  { name: "Canvas", href: "/canvas" },
  { name: "Tools", href: "/tools" },
  // { name: "Pricing", href: "/pricing" },
  { name: "Contact", href: "/contact" },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const triggerReset = useWorkflowStore((s) => s.triggerReset);
  const hasUnsavedChanges = useCanvasStore((s) => s.hasUnsavedChanges);
  const hasMeaningfulChanges = useCanvasStore((s) => s.hasMeaningfulChanges());
  const saveCanvas = useCanvasStore((s) => s.saveCanvas);
  const clearUnsavedChanges = () => {
    useCanvasStore.setState({ hasUnsavedChanges: false, lastSavedTimestamp: new Date() });
  };
  
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingHref, setPendingHref] = useState<string>("");

  const handleNavigation = (href: string, shouldResetWorkflow = false) => {
    // 캔버스 페이지에서 나갈 때만 체크 - meaningful changes가 있을 때만 확인
    if (pathname === "/canvas" && hasMeaningfulChanges) {
      setPendingHref(href);
      setShowUnsavedDialog(true);
      return;
    }

    // 워크플로우 리셋이 필요한 경우
    if (shouldResetWorkflow) {
      triggerReset();
    }

    router.push(href);
  };

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div
            onClick={(e) => {
              e.preventDefault();
              handleNavigation("/", true);
            }}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">
              FlowGenius
            </span>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <div
                key={item.name}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation(item.href);
                }}
                className={`text-base font-bold transition-colors cursor-pointer ${
                  pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.name}
              </div>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <LoginButton />
          </div>
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      <AlertDialog.Root open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
            <div className="flex flex-col space-y-2 text-center sm:text-left">
              <AlertDialog.Title className="text-lg font-semibold">
                Unsaved Changes
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-muted-foreground">
                You have unsaved changes in the canvas. If you leave this page, your changes will be lost.
              </AlertDialog.Description>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <AlertDialog.Cancel
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 mr-2"
              >
                Continue Working
              </AlertDialog.Cancel>
              <AlertDialog.Action 
                onClick={() => {
                  // Reset canvas state completely when leaving without saving
                  useCanvasStore.getState().resetCanvas();
                  clearUnsavedChanges();
                  setShowUnsavedDialog(false);
                  if (pendingHref === "/") {
                    triggerReset();
                  }
                  router.push(pendingHref);
                  setPendingHref("");
                }}
                className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground ring-offset-background transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                Leave without saving
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </header>
  );
}
