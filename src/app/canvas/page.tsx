"use client";

import React from "react";
import { Navigation } from "@/components/Navigation";
import { WorkflowCanvas } from "@/components/canvas/WorkflowCanvas";

export default function CanvasPage() {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Navigation />
      <main className="flex-1 p-0 overflow-hidden">
        <WorkflowCanvas />
      </main>
    </div>
  );
}
