"use client";

import { type RouterOutputs } from "~/trpc/react";
import { Card, CardContent } from "@/components/ui/card";

import { AuctionCard } from "./auction-card";

type OpenAuction = RouterOutputs["auction"]["listOpen"];

export function AuctionGrid({
  auctions,
  currentUserId,
  activeCategory,
  debouncedSearch,
}: {
  auctions: OpenAuction;
  currentUserId: string | null;
  activeCategory: string;
  debouncedSearch: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">Open Auctions</h2>
        <p className="text-muted-foreground text-xs">Auto-refreshing every 2s</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            currentUserId={currentUserId}
          />
        ))}
        {auctions.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {debouncedSearch || activeCategory !== "ALL"
                  ? "No auctions match your current filters."
                  : "No open auctions yet."}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
