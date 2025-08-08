"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Star,
  Heart,
  MessageCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface FeedbackSectionProps {
  onSubmit: (rating: number, comment?: string) => void;
  isSubmitting: boolean;
  isSubmitted: boolean;
}

export function FeedbackSection({
  onSubmit,
  isSubmitting,
  isSubmitted,
}: FeedbackSectionProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit(rating, comment.trim() || undefined);
  };

  const handleStarClick = (value: number) => {
    setRating(value);
  };

  const handleStarHover = (value: number) => {
    setHoveredRating(value);
  };

  const handleStarLeave = () => {
    setHoveredRating(0);
  };

  const getRatingText = (value: number) => {
    switch (value) {
      case 1:
        return "Very Dissatisfied";
      case 2:
        return "Dissatisfied";
      case 3:
        return "Neutral";
      case 4:
        return "Satisfied";
      case 5:
        return "Very Satisfied";
      default:
        return "";
    }
  };

  if (isSubmitted) return null;

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-4" />

      <CardContent className="space-y-6">
        {/* Star Rating */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-foreground">
            Feedback is disabled
          </Label>
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">{null}</div>
            {null}
          </div>
        </div>

        {/* Comment Section */}
        <div className="space-y-2">{null}</div>

        {/* Submit Button */}
        {null}

        {null}
      </CardContent>
    </Card>
  );
}
