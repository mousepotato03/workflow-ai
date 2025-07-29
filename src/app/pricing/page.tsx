"use client";

import React from "react";
import { Navigation } from "@/components/Navigation";
import { Check, Star, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const pricingPlans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for individuals getting started with AI tools",
    icon: Star,
    iconColor: "text-slate-400",
    bgColor: "bg-slate-800",
    borderColor: "border-slate-700",
    buttonStyle: "bg-slate-700 hover:bg-slate-600 text-white",
    features: [
      "Access to 5 AI tools",
      "100 requests per month",
      "Basic support",
      "Community access",
      "Standard processing speed",
    ],
    limitations: [
      "Limited tool selection",
      "Basic features only",
      "No priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "Ideal for professionals and small teams",
    icon: Zap,
    iconColor: "text-blue-400",
    bgColor: "bg-slate-800",
    borderColor: "border-blue-500",
    buttonStyle: "bg-blue-600 hover:bg-blue-700 text-white",
    isPopular: true,
    features: [
      "Access to all AI tools",
      "10,000 requests per month",
      "Priority support",
      "Advanced features",
      "Fast processing speed",
      "API access",
      "Custom integrations",
    ],
    limitations: [],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$99",
    period: "per month",
    description: "For large teams and organizations",
    icon: Crown,
    iconColor: "text-purple-400",
    bgColor: "bg-slate-800",
    borderColor: "border-slate-700",
    buttonStyle: "bg-purple-600 hover:bg-purple-700 text-white",
    features: [
      "Unlimited AI tool access",
      "Unlimited requests",
      "24/7 dedicated support",
      "Custom AI models",
      "Fastest processing speed",
      "Full API access",
      "White-label solutions",
      "Advanced analytics",
      "Team management",
      "SLA guarantee",
    ],
    limitations: [],
  },
];

const faqs = [
  {
    question: "Can I change my plan at any time?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.",
  },
  {
    question: "What happens if I exceed my monthly limits?",
    answer:
      "For Free users, requests will be paused until the next month. Pro and Enterprise users can purchase additional credits or upgrade their plan.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer a 30-day money-back guarantee for all paid plans. Contact our support team for assistance.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "Yes, we offer a 14-day free trial for both Pro and Enterprise plans. No credit card required.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navigation />

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Choose the perfect plan for your AI workflow needs. All plans
            include access to our core features.
          </p>

          <div className="flex items-center justify-center space-x-4 mb-8">
            <Badge
              variant="secondary"
              className="bg-green-900/30 border-green-700 text-green-400"
            >
              ✓ 30-day money-back guarantee
            </Badge>
            <Badge
              variant="secondary"
              className="bg-blue-900/30 border-blue-700 text-blue-400"
            >
              ✓ No setup fees
            </Badge>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {pricingPlans.map((plan) => {
            const IconComponent = plan.icon;
            return (
              <Card
                key={plan.id}
                className={`${plan.bgColor} ${
                  plan.borderColor
                } border-2 hover:border-opacity-80 transition-all duration-200 relative ${
                  plan.isPopular ? "ring-2 ring-blue-500/20" : ""
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className={`w-12 h-12 ${plan.iconColor} mx-auto mb-4`}>
                    <IconComponent className="w-full h-full" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-slate-400 ml-2">/{plan.period}</span>
                  </div>
                  <p className="text-slate-400 text-sm">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  <Button
                    className={`w-full ${plan.buttonStyle} py-3 font-medium`}
                  >
                    {plan.id === "free" ? "Get Started" : "Start Free Trial"}
                  </Button>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-white">
                      Features included:
                    </h4>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start space-x-3">
                          <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-300 text-sm">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {plan.limitations.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-slate-700">
                      <h4 className="font-semibold text-slate-400">
                        Limitations:
                      </h4>
                      <ul className="space-y-2">
                        {plan.limitations.map((limitation, index) => (
                          <li
                            key={index}
                            className="flex items-start space-x-3"
                          >
                            <span className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5">
                              ×
                            </span>
                            <span className="text-slate-400 text-sm">
                              {limitation}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {faqs.map((faq, index) => (
              <Card key={index} className="bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-white mb-3">
                    {faq.question}
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20 py-16 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-3xl border border-slate-800">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to supercharge your workflow?
          </h2>
          <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who are already using FlowGenius to
            streamline their work with AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
              Start Free Trial
            </Button>
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800 px-8 py-3"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
