"use client";

import React, { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  Star,
  Users,
  ExternalLink,
  X,
  Menu,
  RotateCcw,
  Loader2,
  Bookmark,
  MessageCircle,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Types
interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  logo_url?: string;
  categories: string[];
  domains: string[];
  pricing: "Free" | "Paid";
  rating: number;
  reviewCount: number;
  is_active: boolean;
  created_at: string;
  tool_ratings?: Array<{
    review_count: number;
    average_rating: number;
  }>;
}

interface ApiResponse {
  tools: Tool[];
  total: number;
  hasMore: boolean;
}

const sortOptions = ["Popular", "Latest", "Top Rated", "Most Reviewed"];
const pricingOptions = ["All", "Free", "Paid"];

// SidebarContent component moved outside to prevent re-rendering
function SidebarContent({
  searchQuery,
  setSearchQuery,
  handleSearchKeyDown,
  showBookmarkedOnly,
  setShowBookmarkedOnly,
  bookmarks,
  handleResetFilters,
  selectedSort,
  setSelectedSort,
  selectedPricing,
  setSelectedPricing,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  showBookmarkedOnly: boolean;
  setShowBookmarkedOnly: (show: boolean) => void;
  bookmarks: Set<string>;
  handleResetFilters: () => void;
  selectedSort: string;
  setSelectedSort: (sort: string) => void;
  selectedPricing: string;
  setSelectedPricing: (pricing: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Search Tools
          </h3>
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`text-slate-400 hover:text-yellow-400 hover:bg-slate-800 transition-all duration-200 ${
                      showBookmarkedOnly ? "text-yellow-400 bg-slate-800" : ""
                    }`}
                    onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
                    aria-label="Toggle bookmarked tools"
                  >
                    <Bookmark
                      className={`w-5 h-5 ${
                        showBookmarkedOnly ? "fill-current" : ""
                      }`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {showBookmarkedOnly
                    ? "Show all tools"
                    : "Show bookmarked only"}
                  {bookmarks.size > 0 && ` (${bookmarks.size})`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-all duration-200"
                    onClick={handleResetFilters}
                    aria-label="Reset filters"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Reset filters</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-blue-400 transition-colors" />
          <input
            type="text"
            placeholder="Search for tools.."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-slate-750 outline-none"
          />
        </div>
      </div>

      {/* Sort Options */}
      <div>
        <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
          Sort By
        </h3>
        <div className="space-y-2">
          {sortOptions.map((option) => (
            <Button
              key={option}
              onClick={() => setSelectedSort(option)}
              variant={selectedSort === option ? "default" : "secondary"}
              className={`w-full justify-start transition-all duration-200 ${
                selectedSort === option
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              }`}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      {/* Pricing Options */}
      <div>
        <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
          Pricing
        </h3>
        <div className="space-y-2">
          {pricingOptions.map((option) => (
            <Button
              key={option}
              onClick={() => setSelectedPricing(option)}
              variant={selectedPricing === option ? "default" : "secondary"}
              className={`w-full justify-start transition-all duration-200 ${
                selectedPricing === option
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              }`}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface UnifiedModalProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

// Optimized image component
function OptimizedImage({
  src,
  alt,
  className,
  size = 64,
}: {
  src?: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (src) {
      setIsLoading(true);
      setImageError(false);
      const img = new Image();
      img.onload = () => {
        setImageSrc(src);
        setIsLoading(false);
      };
      img.onerror = () => {
        setImageError(true);
        setIsLoading(false);
      };
      img.src = src;
    } else {
      setImageError(true);
      setIsLoading(false);
    }
  }, [src]);

  if (isLoading) {
    return (
      <div
        className={`${className} bg-slate-700 flex items-center justify-center animate-pulse`}
        style={{ width: size, height: size }}
      >
        <ImageIcon className="w-6 h-6 text-slate-500" />
      </div>
    );
  }

  if (imageError || !imageSrc) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center`}
        style={{ width: size, height: size }}
      >
        <span className="text-white font-bold text-[10px]">
          {alt.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}

function UnifiedModal({
  tool,
  isOpen,
  onClose,
  onReviewSubmitted,
}: UnifiedModalProps) {
  const [activeTab, setActiveTab] = useState<"info" | "reviews">("info");
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null); // User's current rating for this tool

  // Reset to info tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("info");
    }
  }, [isOpen]);

  // Fetch review data and user rating
  const fetchReviews = async () => {
    if (!tool || activeTab !== "reviews") return;

    try {
      setLoading(true);
      const response = await fetch(`/api/reviews?tool_id=${tool.id}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        // Check if user has already rated this tool
        setUserRating(data.userRating || null);
        if (data.userRating) {
          setRating(data.userRating);
        }
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  // Submit rating (one-time only)
  const handleSubmitRating = async () => {
    if (!tool || rating === 0 || userRating !== null) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/reviews/rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_id: tool.id,
          rating,
        }),
      });

      if (response.ok) {
        setUserRating(rating);
        onReviewSubmitted();
        fetchReviews(); // Refresh to update overall rating
      } else if (response.status === 401) {
        alert("Please log in to submit a rating.");
      } else {
        const error = await response.json();
        alert(error.error || "An error occurred while submitting the rating.");
      }
    } catch (error) {
      console.error("Failed to submit rating:", error);
      alert("An error occurred while submitting the rating.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit comment (multiple allowed)
  const handleSubmitComment = async () => {
    if (!tool || !comment.trim()) return;

    try {
      setSubmittingComment(true);
      const response = await fetch("/api/reviews/comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_id: tool.id,
          comment: comment.trim(),
        }),
      });

      if (response.ok) {
        setComment("");
        fetchReviews(); // Refresh reviews to show new comment
      } else if (response.status === 401) {
        alert("Please log in to submit a comment.");
      } else {
        const error = await response.json();
        alert(error.error || "An error occurred while submitting the comment.");
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
      alert("An error occurred while submitting the comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Fetch reviews when switching to reviews tab
  useEffect(() => {
    if (activeTab === "reviews" && tool) {
      fetchReviews();
    }
  }, [activeTab, tool]);

  if (!isOpen || !tool) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl w-[1200px] h-[750px] overflow-hidden border border-slate-700 shadow-2xl">
        {/* Fixed Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-[10px]">
                  {tool.name[0]}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{tool.name}</h2>
                <p className="text-slate-400">{tool.description}</p>
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center justify-between mb-6">
            <Button
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg"
              onClick={() => window.open(tool.url, "_blank")}
            >
              <span>Visit Site</span>
              <ExternalLink className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 text-slate-400">
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-white font-semibold">
                    {tool.rating.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>{tool.reviewCount} reviews</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-slate-700">
            <div className="flex space-x-6">
              <button
                className={`pb-3 font-medium transition-colors ${
                  activeTab === "info"
                    ? "border-b-2 border-blue-400 text-blue-400"
                    : "text-slate-400 hover:text-blue-400"
                }`}
                onClick={() => setActiveTab("info")}
              >
                Info
              </button>
              <button
                className={`pb-3 font-medium transition-colors ${
                  activeTab === "reviews"
                    ? "border-b-2 border-blue-400 text-blue-400"
                    : "text-slate-400 hover:text-blue-400"
                }`}
                onClick={() => setActiveTab("reviews")}
              >
                Reviews ({tool.reviewCount})
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="h-[calc(750px-280px)] overflow-y-auto p-6">
          {activeTab === "info" ? (
            // Info Content
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Description
                </h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  {tool.description}
                </p>
                {tool.domains && tool.domains.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2">
                      Key Use Cases
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {tool.domains.map((domain, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-slate-700 text-slate-300"
                        >
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-4">
                  Pros & Cons
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-green-400 mb-1">Pros</h4>
                      <p className="text-muted-foreground text-sm">
                        Improves productivity and efficiency with advanced AI
                        capabilities.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-xs">✕</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-red-400 mb-1">Cons</h4>
                      <p className="text-muted-foreground text-sm">
                        May require learning curve for optimal usage and
                        customization.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Reviews Content
            <div className="space-y-6">
              {/* Rating section (one-time only) */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-4 border border-slate-700 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {userRating !== null ? "Your Rating" : "Rate this Tool"}
                    </h3>
                    {userRating !== null && (
                      <p className="text-xs text-slate-400 mt-1">
                        You have already rated this tool
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() =>
                            userRating === null ? setRating(star) : null
                          }
                          className={`p-0.5 ${
                            userRating !== null
                              ? "cursor-not-allowed"
                              : "cursor-pointer"
                          }`}
                          disabled={userRating !== null}
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= rating
                                ? "fill-yellow-400 text-yellow-400"
                                : userRating !== null
                                ? "text-slate-600"
                                : "text-slate-400 hover:text-yellow-400"
                            } transition-colors`}
                          />
                        </button>
                      ))}
                    </div>
                    {userRating === null && (
                      <Button
                        onClick={handleSubmitRating}
                        disabled={rating === 0 || submitting}
                        size="sm"
                        className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:opacity-50 text-white font-medium px-3 py-1 text-sm transition-all duration-200"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            Rating...
                          </>
                        ) : (
                          "Submit Rating"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Comment section (multiple allowed) */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg p-4 border border-slate-700 mb-4">
                <h3 className="text-base font-semibold text-white mb-3">
                  Add a Comment
                </h3>
                <div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts about this tool..."
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md text-white placeholder:text-slate-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    rows={2}
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-500">
                      {comment.length}/500
                    </span>
                    <Button
                      onClick={handleSubmitComment}
                      disabled={!comment.trim() || submittingComment}
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium px-4 py-1 text-sm transition-all duration-200"
                    >
                      {submittingComment ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          Posting...
                        </>
                      ) : (
                        "Post Comment"
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Review list */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">
                  User Reviews
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg mb-2">
                      No reviews yet
                    </p>
                    <p className="text-slate-500">
                      Be the first to share your experience!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-[8px] font-bold">
                                {review.users.full_name?.[0] || "U"}
                              </span>
                            </div>
                            <div>
                              <p className="text-white font-medium">
                                {review.users.full_name || "Anonymous User"}
                              </p>
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${
                                        i < review.rating
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-slate-600"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-slate-400 text-sm">
                                  {new Date(
                                    review.created_at
                                  ).toLocaleDateString("ko-KR")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-slate-300 leading-relaxed">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton Components
function ToolCardSkeleton() {
  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 backdrop-blur-sm animate-pulse">
      <CardContent className="p-6">
        {/* Header with logo, name, and bookmark */}
        <div className="flex items-start space-x-4 mb-4">
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-slate-700 rounded-lg"></div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-3">
              <div className="h-6 bg-slate-700 rounded w-32"></div>
              <div className="flex items-center space-x-2">
                <div className="h-6 bg-slate-700 rounded w-16"></div>
                <div className="w-5 h-5 bg-slate-700 rounded"></div>
              </div>
            </div>

            {/* Skeleton Categories Section */}
            <div className="mb-3">
              <div className="flex flex-wrap gap-1.5">
                <div className="h-6 bg-slate-700 rounded-full w-20"></div>
                <div className="h-6 bg-slate-700 rounded-full w-16"></div>
                <div className="h-6 bg-slate-700 rounded-full w-24"></div>
                <div className="h-6 bg-slate-700 rounded-full w-12"></div>
              </div>
            </div>

            {/* Skeleton Description */}
            <div className="space-y-2">
              <div className="h-4 bg-slate-700 rounded w-full"></div>
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            </div>
          </div>
        </div>

        {/* Bottom metrics section */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-slate-700 rounded"></div>
              <div className="h-4 bg-slate-700 rounded w-8"></div>
              <div className="h-4 bg-slate-700 rounded w-6"></div>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-slate-700 rounded"></div>
              <div className="h-4 bg-slate-700 rounded w-6"></div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <div className="w-4 h-4 bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-700 rounded w-16"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsHeaderSkeleton() {
  return (
    <div className="mb-8 animate-pulse">
      <div className="h-8 bg-slate-700 rounded w-64"></div>
    </div>
  );
}

function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
      {Array.from({ length: count }, (_, i) => (
        <ToolCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function ToolsPage() {
  const { user, signInWithGoogle } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("Popular");
  const [selectedPricing, setSelectedPricing] = useState("All");
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // API related state
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalTools, setTotalTools] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pageInput, setPageInput] = useState("");

  const TOOLS_PER_PAGE = 20;

  // Bookmark data fetching function
  const fetchBookmarks = async () => {
    try {
      const response = await fetch("/api/bookmarks");
      if (response.ok) {
        const data = await response.json();
        const bookmarkIds = new Set<string>(
          data.bookmarks?.map((bookmark: any) => bookmark.tool_id as string) ||
            []
        );
        setBookmarks(bookmarkIds);
      }
    } catch (error) {
      console.error("Failed to fetch bookmarks:", error);
    }
  };

  // Data fetching function
  const fetchTools = async (page = currentPage) => {
    try {
      setLoading(true);
      setError(null);

      const offset = (page - 1) * TOOLS_PER_PAGE;
      const params = new URLSearchParams({
        search: searchQuery,
        pricing: selectedPricing,
        sort: selectedSort,
        filter: showBookmarkedOnly ? "Bookmarked Only" : "All Tools",
        limit: TOOLS_PER_PAGE.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/tools?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tools list.");
      }

      const data: ApiResponse = await response.json();

      setTools(data.tools);
      setTotalTools(data.total);
      setTotalPages(Math.ceil(data.total / TOOLS_PER_PAGE));
      setCurrentPage(page);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial load - fetch both bookmarks and tools once
  useEffect(() => {
    const initializePage = async () => {
      await fetchBookmarks();
      await fetchTools();
      setIsInitialized(true);
    };

    initializePage();
  }, []);

  // Combined effect for search/filter changes with debouncing (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    const timeoutId = setTimeout(
      () => {
        setCurrentPage(1); // Reset to first page
        fetchTools(1);
      },
      searchQuery ? 500 : 0
    );

    return () => clearTimeout(timeoutId);
  }, [
    searchQuery,
    selectedPricing,
    selectedSort,
    showBookmarkedOnly,
    isInitialized,
  ]);

  // Handle search on Enter key (immediate search)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setCurrentPage(1);
      fetchTools(1);
    }
  };

  // Page navigation functions
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      fetchTools(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const goToFirstPage = () => {
    if (currentPage > 1) {
      goToPage(1);
    }
  };

  const goToLastPage = () => {
    if (currentPage < totalPages) {
      goToPage(totalPages);
    }
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput);
    if (pageNum >= 1 && pageNum <= totalPages) {
      goToPage(pageNum);
      setPageInput("");
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageInputSubmit(e);
    }
  };

  // Bookmark toggle function
  const toggleBookmark = async (toolId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevent card click event
    }

    // 로그인 확인
    if (!user) {
      try {
        await signInWithGoogle();
        return;
      } catch (error) {
        console.error("Login failed:", error);
        return;
      }
    }

    try {
      const isBookmarked = bookmarks.has(toolId);
      const method = isBookmarked ? "DELETE" : "POST";

      const response = await fetch("/api/bookmarks", {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool_id: toolId }),
      });

      if (response.ok) {
        const newBookmarks = new Set(bookmarks);
        if (isBookmarked) {
          newBookmarks.delete(toolId);
        } else {
          newBookmarks.add(toolId);
        }
        setBookmarks(newBookmarks);
      } else if (response.status === 401) {
        alert("Please log in to use the bookmark feature.");
      }
    } catch (error) {
      console.error("Bookmark toggle error:", error);
    }
  };

  const handleToolClick = (tool: Tool) => {
    setSelectedTool(tool);
    setIsModalOpen(true);
  };

  const handleReviewClick = (tool: Tool, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedTool(tool);
    setIsModalOpen(true);
  };

  const handleReviewSubmitted = () => {
    // Reload tools list to update average rating
    fetchTools();
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSort("Popular");
    setSelectedPricing("All");
    setShowBookmarkedOnly(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white">
      <Navigation />

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-80 min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 p-6 backdrop-blur-sm">
          <SidebarContent
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearchKeyDown={handleSearchKeyDown}
            showBookmarkedOnly={showBookmarkedOnly}
            setShowBookmarkedOnly={setShowBookmarkedOnly}
            bookmarks={bookmarks}
            handleResetFilters={handleResetFilters}
            selectedSort={selectedSort}
            setSelectedSort={setSelectedSort}
            selectedPricing={selectedPricing}
            setSelectedPricing={setSelectedPricing}
          />
        </div>

        {/* Mobile Sidebar */}
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="fixed top-20 left-4 z-40 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-all duration-200 backdrop-blur-sm"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-80 bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700"
            >
              <SidebarContent
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearchKeyDown={handleSearchKeyDown}
                showBookmarkedOnly={showBookmarkedOnly}
                setShowBookmarkedOnly={setShowBookmarkedOnly}
                bookmarks={bookmarks}
                handleResetFilters={handleResetFilters}
                selectedSort={selectedSort}
                setSelectedSort={setSelectedSort}
                selectedPricing={selectedPricing}
                setSelectedPricing={setSelectedPricing}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Mobile Search Bar */}
          <div className="lg:hidden mb-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-400 transition-colors" />
              <input
                type="text"
                placeholder="Search for tools... (Press Enter to search)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 text-white placeholder:text-slate-400 rounded-2xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-slate-750 outline-none"
              />
            </div>
          </div>

          {/* Results Header */}
          {loading ? (
            <ResultsHeaderSkeleton />
          ) : (
            <div className="mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Tools Directory
              </h1>
              {error && <p className="text-red-400">{error}</p>}
            </div>
          )}

          {/* Tools Grid */}
          {loading ? (
            <SkeletonGrid count={12} />
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-400 text-lg mb-4">{error}</p>
              <Button
                onClick={() => fetchTools()}
                variant="outline"
                className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 auto-rows-[350px]">
                {tools.map((tool) => (
                  <Card
                    key={tool.id}
                    className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-slate-600 hover:from-slate-700 hover:to-slate-800 transition-all duration-300 cursor-pointer group backdrop-blur-sm hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 h-full"
                    onClick={() => handleToolClick(tool)}
                  >
                    <CardContent className="p-6 h-full flex flex-col">
                      {/* Header with logo, name, and bookmark - Fixed height */}
                      <div className="flex items-start space-x-4 mb-4 flex-shrink-0">
                        <div className="flex-shrink-0">
                          <OptimizedImage
                            src={tool.logo_url}
                            alt={tool.name}
                            className="object-cover rounded-lg border border-slate-600"
                            size={64}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="font-bold text-white text-lg group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300 line-clamp-2 min-h-[56px]">
                              {tool.name}
                            </h3>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Badge
                                variant="secondary"
                                className={`text-xs px-2 py-1 font-medium ${
                                  tool.pricing === "Free"
                                    ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg"
                                    : "bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg"
                                }`}
                              >
                                {tool.pricing}
                              </Badge>
                              <button
                                onClick={(e) => toggleBookmark(tool.id, e)}
                                className={`p-1 rounded-md transition-colors ${
                                  bookmarks.has(tool.id)
                                    ? "text-blue-400 hover:text-blue-300"
                                    : "text-slate-400 hover:text-blue-400"
                                }`}
                                title={
                                  bookmarks.has(tool.id)
                                    ? "Remove bookmark"
                                    : "Add bookmark"
                                }
                              >
                                <Bookmark
                                  className={`w-5 h-5 ${
                                    bookmarks.has(tool.id) ? "fill-current" : ""
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Categories Section - Auto height to avoid overlap with description */}
                          <div className="flex items-start flex-shrink-0">
                            <div className="flex flex-col gap-1.5 w-full items-start">
                              {tool.categories
                                .slice(0, 4)
                                .map((category, index) => (
                                  <Badge
                                    key={index}
                                    variant="outline"
                                    className="w-fit bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/30 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs px-2 py-0.5 leading-tight font-medium"
                                  >
                                    {category}
                                  </Badge>
                                ))}
                              {tool.categories.length > 4 && (
                                <Badge
                                  variant="outline"
                                  className="w-fit bg-slate-700/50 border-slate-500 text-slate-400 text-xs px-2 py-0.5 leading-tight"
                                >
                                  +{tool.categories.length - 4}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description Section - Flexible height that fills available space */}
                      <div className="flex-1 mb-4 min-h-0">
                        <p className="text-slate-400 text-sm leading-relaxed overflow-hidden line-clamp-3">
                          {tool.description}
                        </p>
                      </div>

                      {/* Bottom metrics section - Fixed height at bottom */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-700/50 flex-shrink-0">
                        <div className="flex items-center space-x-4 text-slate-400 text-sm">
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-white font-medium">
                              {tool.rating > 0 ? tool.rating.toFixed(1) : "0.0"}
                            </span>
                            <span className="text-slate-500">
                              ({tool.reviewCount})
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleReviewClick(tool, e)}
                          className="flex items-center space-x-1.5 text-slate-400 hover:text-blue-400 transition-colors text-sm font-medium"
                          title="View reviews"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Reviews</span>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {!loading && tools.length > 0 && totalPages > 1 && (
                <div className="flex flex-col items-center py-8 space-y-4">
                  {/* Pagination controls */}
                  <div className="flex items-center space-x-2">
                    {/* First page button */}
                    <Button
                      onClick={goToFirstPage}
                      disabled={currentPage === 1}
                      variant="outline"
                      className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ width: "40px", height: "40px" }}
                      title="First page"
                    >
                      <span className="text-xs font-bold">⟪</span>
                    </Button>

                    {/* Previous button */}
                    <Button
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      variant="outline"
                      className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ width: "40px", height: "40px" }}
                      title="Previous page"
                    >
                      <span className="text-xs font-bold">⟨</span>
                    </Button>

                    {/* Page numbers */}
                    <div className="flex items-center space-x-1">
                      {/* Show first page if not visible */}
                      {currentPage > 3 && (
                        <>
                          <Button
                            onClick={() => goToPage(1)}
                            variant="outline"
                            className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                            style={{ width: "40px", height: "40px" }}
                          >
                            1
                          </Button>
                          {currentPage > 4 && (
                            <span className="text-slate-400 px-2">...</span>
                          )}
                        </>
                      )}

                      {/* Show pages around current page */}
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          const start = Math.max(
                            1,
                            Math.min(currentPage - 2, totalPages - 4)
                          );
                          const pageNum = start + i;

                          if (pageNum > totalPages) return null;

                          return (
                            <Button
                              key={pageNum}
                              onClick={() => goToPage(pageNum)}
                              variant={
                                currentPage === pageNum ? "default" : "outline"
                              }
                              className={
                                currentPage === pageNum
                                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                                  : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                              }
                              style={{ width: "40px", height: "40px" }}
                            >
                              {pageNum}
                            </Button>
                          );
                        }
                      )}

                      {/* Show last page if not visible */}
                      {currentPage < totalPages - 2 && (
                        <>
                          {currentPage < totalPages - 3 && (
                            <span className="text-slate-400 px-2">...</span>
                          )}
                          <Button
                            onClick={() => goToPage(totalPages)}
                            variant="outline"
                            className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                            style={{ width: "40px", height: "40px" }}
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Next button */}
                    <Button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10"
                      title="Next page"
                    >
                      <span className="text-xs font-bold">⟩</span>
                    </Button>

                    {/* Last page button */}
                    <Button
                      onClick={goToLastPage}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10"
                      title="Last page"
                    >
                      <span className="text-xs font-bold">⟫</span>
                    </Button>
                  </div>

                  {/* Page input */}
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-slate-400">Go to page:</span>
                    <form
                      onSubmit={handlePageInputSubmit}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value)}
                        onKeyDown={handlePageInputKeyDown}
                        placeholder={currentPage.toString()}
                        className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 text-white text-center rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white text-xs px-3 py-1"
                      >
                        Go
                      </Button>
                    </form>
                    <span className="text-slate-500">of {totalPages}</span>
                  </div>
                </div>
              )}

              {tools.length === 0 && !loading && (
                <div className="text-center py-16">
                  {showBookmarkedOnly ? (
                    <div className="text-center py-8">
                      <Bookmark className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-slate-400 mb-2">
                        No bookmarked tools
                      </h3>
                      <p className="text-slate-500 mb-4">
                        You haven't bookmarked any tools yet. Start exploring
                        and bookmark your favorites!
                      </p>
                      <Button
                        onClick={() => setShowBookmarkedOnly(false)}
                        variant="outline"
                        className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200"
                      >
                        Browse All Tools
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-slate-400 mb-2">
                        No tools found
                      </h3>
                      <p className="text-slate-500">
                        Try adjusting your search or filters.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <UnifiedModal
        tool={selectedTool}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </div>
  );
}
