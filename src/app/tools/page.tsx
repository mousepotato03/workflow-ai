"use client";

import React, { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Search, Star, Users, Heart, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// AI Tools data matching the image
const aiTools = [
  {
    id: 1,
    name: "DeepArt",
    description: "AI-powered image generator",
    category: "Image",
    image: "https://picsum.photos/400/300?random=1",
    likes: 1200,
    comments: 12,
    rating: 4.8,
    url: "https://example.com/deepart",
  },
  {
    id: 2,
    name: "TextCraft",
    description: "Craft compelling text with AI",
    category: "Text",
    image: "https://picsum.photos/400/300?random=2",
    likes: 980,
    comments: 25,
    rating: 4.6,
    url: "https://example.com/textcraft",
  },
  {
    id: 3,
    name: "VideoGenius",
    description: "Generate videos from text",
    category: "Video",
    image: "https://picsum.photos/400/300?random=3",
    likes: 850,
    comments: 50,
    rating: 4.7,
    url: "https://example.com/videogenius",
  },
  {
    id: 4,
    name: "SoundSculpt",
    description: "Edit audio with AI precision",
    category: "Audio",
    image: "https://picsum.photos/400/300?random=4",
    likes: 700,
    comments: 8,
    rating: 4.5,
    url: "https://example.com/soundsculpt",
  },
  {
    id: 5,
    name: "AI Writing Assistant",
    description:
      "An AI-powered tool that helps you write better content, faster.",
    category: "Text",
    image: "https://picsum.photos/400/300?random=5",
    likes: 1500,
    comments: 45,
    rating: 4.9,
    url: "https://example.com/ai-writing",
  },
  {
    id: 6,
    name: "ImageMaster",
    description: "Professional image editing with AI",
    category: "Image",
    image: "https://picsum.photos/400/300?random=6",
    likes: 920,
    comments: 18,
    rating: 4.4,
    url: "https://example.com/imagemaster",
  },
];

const categories = [
  "All",
  "Image Generation",
  "Text Generation",
  "Video Editing",
  "Audio Editing",
];
const sortOptions = ["Popular", "Latest"];

interface ToolModalProps {
  tool: (typeof aiTools)[0] | null;
  isOpen: boolean;
  onClose: () => void;
}

function ToolModal({ tool, isOpen, onClose }: ToolModalProps) {
  if (!isOpen || !tool) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2">
              <span>Visit Site</span>
              <ExternalLink className="w-4 h-4" />
            </Button>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 text-slate-400">
                <Heart className="w-4 h-4" />
                <span>{tool.likes}</span>
              </div>
              <div className="flex items-center space-x-1 text-slate-400">
                <Users className="w-4 h-4" />
                <span>{tool.comments}</span>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-700 mb-6">
            <div className="flex space-x-6">
              <button className="pb-3 border-b-2 border-blue-400 text-blue-400 font-medium">
                Info
              </button>
              <button className="pb-3 text-slate-400 font-medium">
                Reviews
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">Description</h3>
              <p className="text-slate-300 leading-relaxed">
                This AI {tool.category.toLowerCase()} tool is designed to help
                users create high-quality content efficiently. It offers
                features such as advanced algorithms, user-friendly interface,
                and seamless integration. The tool is suitable for various
                creative tasks and professional applications.
              </p>
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
                    <p className="text-slate-300 text-sm">
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
                    <p className="text-slate-300 text-sm">
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

export default function ToolsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSort, setSelectedSort] = useState("Popular");
  const [selectedTool, setSelectedTool] = useState<(typeof aiTools)[0] | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleToolClick = (tool: (typeof aiTools)[0]) => {
    setSelectedTool(tool);
    setIsModalOpen(true);
  };

  const filteredTools = aiTools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" ||
      tool.category === selectedCategory.split(" ")[0];
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search for tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 py-3 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 rounded-2xl text-lg"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => setSelectedCategory(category)}
                variant={
                  selectedCategory === category ? "default" : "secondary"
                }
                className={`rounded-full ${
                  selectedCategory === category
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                {category}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            {sortOptions.map((option) => (
              <Button
                key={option}
                onClick={() => setSelectedSort(option)}
                variant={selectedSort === option ? "default" : "secondary"}
                className={`rounded-full ${
                  selectedSort === option
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTools.map((tool) => (
            <Card
              key={tool.id}
              className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors cursor-pointer group"
              onClick={() => handleToolClick(tool)}
            >
              <CardContent className="p-0">
                <div className="relative">
                  <img
                    src={tool.image}
                    alt={tool.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors rounded-t-lg" />
                </div>

                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">
                      {tool.name}
                    </h3>
                  </div>

                  <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                    {tool.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <Badge
                      variant="secondary"
                      className="bg-slate-700 text-slate-300"
                    >
                      {tool.category}
                    </Badge>

                    <div className="flex items-center space-x-3 text-slate-400 text-sm">
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>{tool.likes}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{tool.comments}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">
              No tools found matching your criteria.
            </p>
          </div>
        )}
      </main>

      <ToolModal
        tool={selectedTool}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
