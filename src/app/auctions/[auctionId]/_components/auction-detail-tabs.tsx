"use client";

import Link from "next/link";
import { Calendar, Info, Ruler, Tag } from "lucide-react";
import { useState } from "react";

import { getAuctionCategoryLabel, type AuctionCategoryValue } from "~/lib/auctions/categories";
import { getAuctionConditionLabel } from "~/lib/auctions/conditions";
import { cn } from "@/lib/utils";

type AuctionDetailBid = {
  id: string;
  bidderId: string;
  amountCents: number;
  createdAt: Date;
  bidderName: string | null;
};

function formatBidDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getInitials(name: string | null): string {
  if (!name) return "??";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();

  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function AuctionDetailTabs({
  description,
  category,
  dimensions,
  artworkYear,
  condition,
  bidHistory,
  bidCount,
}: {
  description: string | null;
  category: AuctionCategoryValue;
  dimensions: string | null;
  artworkYear: number | null;
  condition: string | null;
  bidHistory: AuctionDetailBid[];
  bidCount: number;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");

  return (
    <div className="space-y-4">
      <div className="h-px w-full bg-border" />

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        <button
          type="button"
          className={cn(
            "rounded-lg px-4 py-2.5 text-base font-medium transition-colors",
            activeTab === "details"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>
        <button
          type="button"
          className={cn(
            "rounded-lg px-4 py-2.5 text-base font-medium transition-colors",
            activeTab === "history"
              ? "bg-card text-foreground shadow-sm ring-2 ring-accent/75"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setActiveTab("history")}
        >
          Bid History ({bidCount})
        </button>
      </div>

      {activeTab === "details" ? (
        <div className="space-y-5">
          <p className="text-muted-foreground text-base leading-relaxed">
            {description ?? "No description provided."}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <Tag className="text-muted-foreground size-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Medium</p>
                <p className="text-base font-medium">
                  {getAuctionCategoryLabel(category)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <Ruler className="text-muted-foreground size-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Dimensions</p>
                <p className="text-base font-medium">{dimensions ?? "Not specified"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <Calendar className="text-muted-foreground size-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Year</p>
                <p className="text-base font-medium">{artworkYear ?? "Not specified"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <Info className="text-muted-foreground size-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Condition</p>
                <p className="text-base font-medium">{getAuctionConditionLabel(condition)}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          {bidHistory.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">No bids yet.</p>
          ) : (
            bidHistory.map((bid, index) => (
              <div
                key={bid.id}
                className="flex items-center justify-between gap-4 border-b border-border py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-full text-xl font-semibold",
                      index === 0
                        ? "bg-accent/20 text-accent"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {getInitials(bid.bidderName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">
                      <Link
                        href={`/profile/${bid.bidderId}`}
                        className="hover:underline"
                      >
                        {bid.bidderName ?? "Unknown bidder"}
                      </Link>
                      {index === 0 ? (
                        <span className="text-accent ml-2 text-sm">Leading</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-sm">{formatBidDate(bid.createdAt)}</p>
                  </div>
                </div>
                <p className="font-serif shrink-0 text-2xl font-semibold">
                  {currencyFormatter.format(bid.amountCents / 100)}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
