"use client";

import React, { useState } from "react";
import { Navigation } from "@/components/Navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  MessageSquare,
  ExternalLink,
  Search,
  Filter,
} from "lucide-react";

// Mock data for tools (would be fetched from database in real implementation)
const mockTools = [
  {
    id: "1",
    name: "ChatGPT",
    description:
      "AI-powered conversational assistant for various tasks including writing, coding, and problem-solving.",
    url: "https://chat.openai.com",
    logo_url: "https://picsum.photos/64/64?random=1",
    categories: ["AI", "Writing", "Coding"],
    pros: ["Versatile", "Easy to use", "Fast responses"],
    cons: ["Limited context", "Can be inaccurate"],
    likes: 1250,
    reviews: 89,
  },
  {
    id: "2",
    name: "Notion",
    description:
      "All-in-one workspace for notes, docs, wikis, and project management.",
    url: "https://notion.so",
    logo_url: "https://picsum.photos/64/64?random=2",
    categories: ["Productivity", "Documentation", "Project Management"],
    pros: ["Flexible", "Great templates", "Collaboration features"],
    cons: ["Learning curve", "Can be slow"],
    likes: 890,
    reviews: 156,
  },
  {
    id: "3",
    name: "Figma",
    description:
      "Collaborative interface design tool for creating user interfaces and prototypes.",
    url: "https://figma.com",
    logo_url: "https://picsum.photos/64/64?random=3",
    categories: ["Design", "Collaboration", "Prototyping"],
    pros: ["Real-time collaboration", "Web-based", "Great plugins"],
    cons: ["Requires internet", "Limited offline features"],
    likes: 734,
    reviews: 67,
  },
  {
    id: "4",
    name: "Slack",
    description:
      "Team communication platform with channels, direct messages, and integrations.",
    url: "https://slack.com",
    logo_url: "https://picsum.photos/64/64?random=4",
    categories: ["Communication", "Team Collaboration"],
    pros: ["Great integrations", "Organized channels", "Search functionality"],
    cons: ["Can be noisy", "Expensive for large teams"],
    likes: 623,
    reviews: 134,
  },
  {
    id: "5",
    name: "Trello",
    description:
      "Visual project management tool based on Kanban boards for organizing tasks.",
    url: "https://trello.com",
    logo_url: "https://picsum.photos/64/64?random=5",
    categories: ["Project Management", "Task Management"],
    pros: ["Simple interface", "Visual boards", "Free tier available"],
    cons: ["Limited advanced features", "Can become cluttered"],
    likes: 456,
    reviews: 98,
  },
  {
    id: "6",
    name: "Canva",
    description:
      "Graphic design platform for creating social media graphics, presentations, and marketing materials.",
    url: "https://canva.com",
    logo_url: "https://picsum.photos/64/64?random=6",
    categories: ["Design", "Marketing", "Content Creation"],
    pros: ["User-friendly", "Great templates", "Stock photos included"],
    cons: ["Limited customization", "Premium features cost extra"],
    likes: 812,
    reviews: 203,
  },
];

const categories = [
  "All",
  "AI",
  "Design",
  "Productivity",
  "Communication",
  "Project Management",
  "Marketing",
  "Coding",
  "Writing",
];
const sortOptions = ["Most Popular", "Newest", "Most Reviews", "Alphabetical"];

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("Most Popular");

  const filteredTools = mockTools
    .filter((tool) => {
      const matchesSearch =
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" ||
        tool.categories.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "Most Popular":
          return b.likes - a.likes;
        case "Most Reviews":
          return b.reviews - a.reviews;
        case "Alphabetical":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Explore AI Tools
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Discover the best tools to boost your productivity and creativity
          </p>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 max-w-4xl mx-auto mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-input border-input text-foreground placeholder-muted-foreground"
              />
            </div>

            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-full md:w-48 bg-input border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48 bg-input border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Showing {filteredTools.length} tools
            {selectedCategory !== "All" && <span> in {selectedCategory}</span>}
            {searchQuery && <span> for "{searchQuery}"</span>}
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => (
            <Card
              key={tool.id}
              className="bg-card border-border hover:border-muted-foreground transition-colors"
            >
              <CardHeader>
                <div className="flex items-start space-x-4">
                  <img
                    src={tool.logo_url}
                    alt={`${tool.name} logo`}
                    className="w-12 h-12 rounded-lg"
                  />
                  <div className="flex-1">
                    <CardTitle className="text-foreground text-lg mb-1">
                      {tool.name}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {tool.categories.slice(0, 2).map((category) => (
                        <Badge
                          key={category}
                          variant="secondary"
                          className="text-xs"
                        >
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <CardDescription className="text-muted-foreground mb-4 line-clamp-3">
                  {tool.description}
                </CardDescription>

                {/* Stats */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Heart className="w-4 h-4" />
                      <span>{tool.likes}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{tool.reviews}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-primary hover:bg-primary/90"
                    onClick={() => window.open(tool.url, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Visit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-muted"
                  >
                    <Heart className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-muted"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Results */}
        {filteredTools.length === 0 && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <Filter className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No tools found</h3>
              <p>
                Try adjusting your search criteria or browse all categories.
              </p>
            </div>
            <Button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
