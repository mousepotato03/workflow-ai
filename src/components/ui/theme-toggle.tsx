"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const { toast } = useToast();
  const [trollEffect, setTrollEffect] = React.useState("");
  const [clickCount, setClickCount] = React.useState(0);
  const lightItemRef = React.useRef<HTMLDivElement>(null);

  const trollEffects = [
    "animate-bounce",
    "animate-spin",
    "shake",
    "escape"
  ];

  const handleLightThemeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);
    
    // Show toast on 5th click
    if (newClickCount >= 5) {
      toast({
        title: "Big Error",
        description: "I Hate Light Theme 🌙",
        duration: 4000,
      });
      setClickCount(0); // Reset counter
      return;
    }
    
    const randomEffect = trollEffects[Math.floor(Math.random() * trollEffects.length)];
    setTrollEffect(randomEffect);
    
    if (randomEffect === "escape" && lightItemRef.current) {
      const randomX = Math.random() * 200 - 100;
      const randomY = Math.random() * 200 - 100;
      lightItemRef.current.style.transform = `translate(${randomX}px, ${randomY}px)`;
      lightItemRef.current.style.transition = "transform 0.3s ease-out";
    }
    
    setTimeout(() => {
      setTrollEffect("");
      if (lightItemRef.current) {
        lightItemRef.current.style.transform = "";
      }
    }, 1000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-muted transition-colors"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuItem 
          ref={lightItemRef}
          onClick={handleLightThemeClick}
          className={`cursor-pointer relative ${trollEffect} ${
            trollEffect === "shake" ? "animate-[shake_0.5s_ease-in-out]" : ""
          } ${
            trollEffect === "wobble" ? "animate-[wobble_0.6s_ease-in-out]" : ""
          }`}
          style={{
            animationIterationCount: trollEffect ? "3" : "1"
          }}
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
          {theme === "light" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className="cursor-pointer"
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
          {theme === "dark" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")}
          className="cursor-pointer"
        >
          <Monitor className="mr-2 h-4 w-4" />
          <span>System</span>
          {theme === "system" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}