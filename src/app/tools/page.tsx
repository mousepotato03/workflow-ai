"use client";

import React, { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
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
  bench_score: number | null;
  cost_index: number | null;
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

interface ToolModalProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReviews: (tool: Tool) => void;
}

interface ReviewModalProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

// Optimized image component
function OptimizedImage({ src, alt, className, size = 64 }: { 
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
        <span className="text-white font-bold text-lg">
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

function ToolModal({ tool, isOpen, onClose, onOpenReviews }: ToolModalProps) {
  if (!isOpen || !tool) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl w-[1200px] h-[750px] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">
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
              <div className="flex items-center space-x-1 text-slate-400">
                <Users className="w-4 h-4" />
                <span>{tool.reviewCount}</span>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-700 mb-6">
            <div className="flex space-x-6">
              <button className="pb-3 border-b-2 border-blue-400 text-blue-400 font-medium">
                Info
              </button>
              <button
                className="pb-3 text-slate-400 font-medium hover:text-blue-400 transition-colors"
                onClick={() => {
                  onClose();
                  onOpenReviews(tool);
                }}
              >
                Reviews ({tool.reviewCount})
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Description</h3>
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
              <h3 className="text-xl font-bold text-white mb-4">Pros & Cons</h3>
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
        </div>
      </div>
    </div>
  );
}

// Review modal component
function ReviewModal({
  tool,
  isOpen,
  onClose,
  onReviewSubmitted,
}: ReviewModalProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch review data
  const fetchReviews = async () => {
    if (!tool) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/reviews?tool_id=${tool.id}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  // Submit review
  const handleSubmitReview = async () => {
    if (!tool || rating === 0) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_id: tool.id,
          rating,
          comment: comment.trim() || null,
        }),
      });

      if (response.ok) {
        setRating(0);
        setComment("");
        fetchReviews();
        onReviewSubmitted();
      } else {
        const error = await response.json();
        alert(error.error || "An error occurred while submitting the review.");
      }
    } catch (error) {
      console.error("Failed to submit review:", error);
      alert("An error occurred while submitting the review.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen && tool) {
      fetchReviews();
    }
  }, [isOpen, tool]);

  if (!isOpen || !tool) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl w-[1200px] h-[750px] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {tool.name} Reviews
              </h2>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-white font-semibold">
                    {tool.rating.toFixed(1)}
                  </span>
                  <span className="text-slate-400">
                    ({tool.reviewCount} reviews)
                  </span>
                </div>
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

          {/* Review writing section */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">
              Write a Review
            </h3>

            {/* Rating selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rating
              </label>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-slate-400 hover:text-yellow-400"
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this tool..."
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                rows={3}
                maxLength={500}
              />
              <div className="text-right text-sm text-slate-400 mt-1">
                {comment.length}/500
              </div>
            </div>

            <Button
              onClick={handleSubmitReview}
              disabled={rating === 0 || submitting}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Submit Review"
              )}
            </Button>
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
                  <div key={review.id} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 border border-slate-700">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
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
                              {new Date(review.created_at).toLocaleDateString(
                                "ko-KR"
                              )}
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
      <div className="h-8 bg-slate-700 rounded w-64 mb-2"></div>
      <div className="h-5 bg-slate-700 rounded w-48"></div>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("Popular");
  const [selectedPricing, setSelectedPricing] = useState("All");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // API 관련 상태
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [hasMoreData, setHasMoreData] = useState(true);
  const [offset, setOffset] = useState(0);

  // Bookmark data fetching function
  const fetchBookmarks = async () => {
    try {
      const response = await fetch("/api/bookmarks");
      if (response.ok) {
        const data = await response.json();
        const bookmarkIds = new Set<string>(
          data.bookmarks?.map((bookmark: any) => bookmark.tool_id as string) || []
        );
        setBookmarks(bookmarkIds);
      }
    } catch (error) {
      console.error("Failed to fetch bookmarks:", error);
    }
  };

  // Data fetching function
  const fetchTools = async (loadMore = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setOffset(0);
      }
      setError(null);

      const currentOffset = loadMore ? offset : 0;
      const params = new URLSearchParams({
        search: searchQuery,
        pricing: selectedPricing,
        sort: selectedSort,
        limit: "20",
        offset: currentOffset.toString(),
      });

      const response = await fetch(`/api/tools?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tools list.");
      }

      const data: ApiResponse = await response.json();
      
      if (loadMore) {
        setTools(prev => [...prev, ...data.tools]);
      } else {
        setTools(data.tools);
      }
      
      setHasMoreData(data.hasMore);
      setOffset(currentOffset + data.tools.length);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch both bookmarks and tools on initial load
  useEffect(() => {
    fetchTools();
    fetchBookmarks();
  }, []);

  // useEffect for search debouncing
  useEffect(() => {
    const timeoutId = setTimeout(
      () => {
        fetchTools();
      },
      searchQuery ? 500 : 0
    ); // 검색어가 있을 때만 디바운스 적용

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Infinite scroll function
  const loadMoreTools = () => {
    if (!loadingMore && hasMoreData) {
      fetchTools(true);
    }
  };

  // Scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        loadMoreTools();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadingMore, hasMoreData, offset]);

  // Reload immediately when price or sort changes
  useEffect(() => {
    fetchTools();
  }, [selectedPricing, selectedSort]);

  // Bookmark toggle function
  const toggleBookmark = async (toolId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // 카드 클릭 이벤트 방지
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
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmitted = () => {
    // Reload tools list to update average rating
    fetchTools();
  };


  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedSort("Popular");
    setSelectedPricing("All");
  };

  const SidebarContent = () => {
    return (
      <div className="space-y-6">
        {/* Search Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Search Tools</h3>
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
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-blue-400 transition-colors" />
            <Input
              placeholder="Search for tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-slate-750"
            />
          </div>
        </div>

        {/* Sort Options */}
        <div>
          <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">Sort By</h3>
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
          <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">Pricing</h3>
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white">
      <Navigation />

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-80 min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 p-6 backdrop-blur-sm">
          <SidebarContent />
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
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Mobile Search Bar */}
          <div className="lg:hidden mb-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-400 transition-colors" />
              <Input
                placeholder="Search for tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-4 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 rounded-2xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:bg-slate-750"
              />
            </div>
          </div>

          {/* Results Header */}
          {loading ? (
            <ResultsHeaderSkeleton />
          ) : (
            <div className="mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">Tools Directory</h1>
              {error ? (
                <p className="text-red-400">{error}</p>
              ) : (
                <p className="text-slate-400">
                  {tools.length} {tools.length === 1 ? 'tool' : 'tools'} found
                  {searchQuery && ` for "${searchQuery}"`}
                  {selectedPricing !== "All" && ` (${selectedPricing})`}
                </p>
              )}
            </div>
          )}

          {/* Tools Grid */}
          {loading ? (
            <SkeletonGrid count={12} />
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-400 text-lg mb-4">{error}</p>
              <Button onClick={() => fetchTools()} variant="outline" className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200">
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {tools.map((tool) => (
                  <Card
                    key={tool.id}
                    className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 hover:border-slate-600 hover:from-slate-700 hover:to-slate-800 transition-all duration-300 cursor-pointer group backdrop-blur-sm hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1"
                    onClick={() => handleToolClick(tool)}
                  >
                    <CardContent className="p-6">
                      {/* Header with logo, name, and bookmark */}
                      <div className="flex items-start space-x-4 mb-4">
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
                            <h3 className="font-bold text-white text-lg group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                              {tool.name}
                            </h3>
                            <div className="flex items-center space-x-2">
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
                          
                          {/* Prominent Categories Section */}
                          <div className="mb-3">
                            <div className="flex flex-wrap gap-1.5">
                              {tool.categories.slice(0, 4).map((category, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/30 text-blue-300 hover:bg-blue-500/30 transition-colors text-xs px-2.5 py-1 font-medium"
                                >
                                  {category}
                                </Badge>
                              ))}
                              {tool.categories.length > 4 && (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-700/50 border-slate-500 text-slate-400 text-xs px-2.5 py-1"
                                >
                                  +{tool.categories.length - 4}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
                            {tool.description}
                          </p>
                        </div>
                      </div>

                      {/* Bottom metrics section */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                        <div className="flex items-center space-x-4 text-slate-400 text-sm">
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-white font-medium">
                              {tool.rating > 0 ? tool.rating.toFixed(1) : "0.0"}
                            </span>
                            <span className="text-slate-500">({tool.reviewCount})</span>
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
                
                {/* Show skeleton cards while loading more */}
                {loadingMore && (
                  <>
                    {Array.from({ length: 8 }, (_, i) => (
                      <ToolCardSkeleton key={`skeleton-${i}`} />
                    ))}
                  </>
                )}
              </div>

              {/* Load more button or loading indicator */}
              {!loading && tools.length > 0 && (
                <div className="flex justify-center py-8">
                  {loadingMore ? (
                    <div className="flex items-center space-x-2 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading more tools...</span>
                    </div>
                  ) : hasMoreData ? (
                    <Button
                      onClick={loadMoreTools}
                      variant="outline"
                      className="bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200 px-8 py-3 rounded-xl"
                    >
                      Load More
                    </Button>
                  ) : (
                    tools.length > 0 && (
                      <p className="text-slate-400 text-sm">
                        All tools have been loaded.
                      </p>
                    )
                  )}
                </div>
              )}

              {tools.length === 0 && !loading && (
                <div className="text-center py-16">
                  <div className="text-center py-8">
                    <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-xl mb-2">
                      No tools found
                    </p>
                    <p className="text-slate-500">
                      Try adjusting your search criteria or filters.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ToolModal
        tool={selectedTool}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onOpenReviews={(tool) => {
          setSelectedTool(tool);
          setIsReviewModalOpen(true);
        }}
      />

      <ReviewModal
        tool={selectedTool}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </div>
  );
}
