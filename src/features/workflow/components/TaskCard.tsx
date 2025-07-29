"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
} from "lucide-react";
import { WorkflowResponse } from "@/types/workflow";

interface TaskCardProps {
  task: WorkflowResponse["tasks"][0];
}

export function TaskCard({ task }: TaskCardProps) {
  const handleToolClick = () => {
    if (task.recommendedTool?.url) {
      window.open(task.recommendedTool.url, "_blank", "noopener,noreferrer");
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8)
      return "text-green-400 bg-green-900/30 border-green-700";
    if (confidence >= 0.6)
      return "text-yellow-400 bg-yellow-900/30 border-yellow-700";
    return "text-red-400 bg-red-900/30 border-red-700";
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence === 0) return "No Recommendation";
    if (confidence >= 0.8) return "High Confidence";
    if (confidence >= 0.6) return "Medium Confidence";
    return "Low Confidence";
  };

  return (
    <Card className="border border-slate-700 bg-slate-800 hover:border-slate-600 transition-colors duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-semibold text-white">
              {task.order}
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">{task.name}</h3>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`${getConfidenceColor(task.confidence)} border`}
          >
            {getConfidenceText(task.confidence)}
          </Badge>
        </div>

        {task.recommendedTool ? (
          <div className="bg-slate-900 rounded-lg p-4 space-y-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {task.recommendedTool.logoUrl ? (
                  <img
                    src={task.recommendedTool.logoUrl}
                    alt={`${task.recommendedTool.name} logo`}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-600"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      target.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={`w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center ${
                    task.recommendedTool.logoUrl ? "hidden" : ""
                  }`}
                >
                  <ImageIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">
                    {task.recommendedTool.name}
                  </h4>
                  <p className="text-sm text-slate-400">Recommended Tool</p>
                </div>
              </div>

              <Button
                onClick={handleToolClick}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open
              </Button>
            </div>

            <div className="border-t border-slate-600 pt-3">
              <p className="text-sm text-slate-300 leading-relaxed">
                <span className="font-medium text-white">Why recommended:</span>{" "}
                {task.recommendationReason}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-300">
                No suitable tool found
              </p>
              <p className="text-sm text-orange-400 mt-1">
                {task.recommendationReason}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
