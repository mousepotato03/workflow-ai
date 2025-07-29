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

  if (isSubmitted) {
    return (
      <Card className="bg-green-900/30 border-green-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-green-300">
                Thank you for your feedback!
              </h3>
              <p className="text-sm text-green-400">
                Your valuable input helps us provide better service.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-700 bg-slate-800">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <Heart className="w-5 h-5 text-pink-400" />
          <CardTitle className="text-lg text-white">
            Was this recommendation helpful?
          </CardTitle>
        </div>
        <p className="text-sm text-slate-400">
          Your feedback greatly helps improve AI recommendation quality.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Star Rating */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-white">
            Please rate your satisfaction (1-5 stars)
          </Label>
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleStarClick(value)}
                  onMouseEnter={() => handleStarHover(value)}
                  onMouseLeave={handleStarLeave}
                  className="p-1 transition-transform duration-150 hover:scale-110"
                  disabled={isSubmitting}
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      value <= (hoveredRating || rating)
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-slate-600"
                    }`}
                  />
                </button>
              ))}
            </div>
            {(hoveredRating || rating) > 0 && (
              <span className="text-sm text-slate-400 ml-3">
                {getRatingText(hoveredRating || rating)}
              </span>
            )}
          </div>
        </div>

        {/* Comment Section */}
        <div className="space-y-2">
          <Label
            htmlFor="feedback-comment"
            className="text-sm font-medium text-white"
          >
            Additional Comments (Optional)
          </Label>
          <Textarea
            id="feedback-comment"
            placeholder="Feel free to share your thoughts or suggestions..."
            className="min-h-[80px] resize-none bg-slate-900 border-slate-700 text-white placeholder:text-slate-400"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || isSubmitting}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-medium py-2 rounded-lg transition-all duration-200"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4 mr-2" />
              Submit Feedback
            </>
          )}
        </Button>

        {rating === 0 && (
          <p className="text-xs text-slate-500 text-center">
            Please select a rating
          </p>
        )}
      </CardContent>
    </Card>
  );
}
