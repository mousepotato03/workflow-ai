"use client";

import React from "react";
import { WorkflowInputForm } from "@/features/workflow/components/WorkflowInputForm";
import { WorkflowResultDisplay } from "@/features/workflow/components/WorkflowResultDisplay";
import { Navigation } from "@/components/Navigation";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";

// Recommended Workflow data matching the image
const recommendedWorkflows = [
  {
    id: 1,
    title: "Define Project Scope",
    description:
      "Clearly outline the objectives, deliverables, and timelines for your project. This ensures everyone is aligned.",
    tool: "Project Canvas",
    toolIcon: "🎯",
  },
  {
    id: 2,
    title: "Task Management",
    description:
      "Break down the project into smaller, manageable tasks and assign them to team members for clear ownership.",
    tool: "TaskMaster",
    toolIcon: "✅",
  },
  {
    id: 3,
    title: "Collaboration",
    description:
      "Facilitate seamless communication and file sharing among team members to foster a collaborative environment.",
    tool: "TeamConnect",
    toolIcon: "👥",
  },
  {
    id: 4,
    title: "Progress Tracking",
    description:
      "Monitor the progress of tasks and the overall project to ensure timely completion and identify bottlenecks.",
    tool: "ProgressTracker",
    toolIcon: "📊",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Describe your goal, we design the workflow
          </h1>
          <p className="text-xl text-slate-400 mb-12">
            AI-powered tool recommendations to get your work done faster
          </p>

          {/* Input Form */}
          <div className="bg-slate-900 rounded-2xl p-8 mb-16">
            <WorkflowInputForm />
          </div>

          {/* Results Display */}
          <WorkflowResultDisplay />
        </div>

        {/* Recommended Workflow Section */}
        <div className="mt-24">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Recommended Workflow
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendedWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-slate-900 rounded-xl p-6 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-start space-x-4 mb-6">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {workflow.id}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-3">
                      {workflow.title}
                    </h3>
                    <p className="text-slate-400 leading-relaxed">
                      {workflow.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{workflow.toolIcon}</span>
                    <span className="text-white font-medium">
                      {workflow.tool}
                    </span>
                  </div>
                  <button className="text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1">
                    <span>Learn More</span>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Error Modal */}
      <LoginRequiredModal />
    </div>
  );
}
