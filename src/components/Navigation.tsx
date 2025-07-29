"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoginButton from "@/components/LoginButton";

const navigationItems = [
  { name: "Home", href: "/" },
  { name: "Tools", href: "/tools" },
  { name: "Pricing", href: "/pricing" },
  { name: "Contact", href: "/contact" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">FlowGenius</span>
          </Link>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? "text-blue-400"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-10 h-10 p-0"
            >
              <Bell className="w-4 h-4" />
            </Button>
            <LoginButton />
          </div>
        </div>
      </div>
    </header>
  );
}
