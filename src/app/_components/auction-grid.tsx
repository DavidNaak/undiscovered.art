"use client";

import { type RouterOutputs } from "~/trpc/react";
import { Card, CardContent } from "@/components/ui/card";

import { AuctionCard } from "./auction-card";

type OpenAuction = RouterOutputs["auction"]["listOpen"];

export function AuctionGrid({
  auctions,
  currentUserId,
  searchQuery,
}: {
  auctions: OpenAuction;
  currentUserId: string | null;
  searchQuery?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Open Auctions</h2>
        {searchQuery ? (
          <p className="text-sm text-muted-foreground">
            Showing results for <span className="font-medium">&quot;{searchQuery}&quot;</span>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Freshly listed artwork available for bidding.
          </p>
        )}
        <p className="text-xs text-muted-foreground">Auto-refreshing every 2s.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {auctions.map((auction) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            currentUserId={currentUserId}
          />
        ))}
        {auctions.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? `No open auctions match "${searchQuery}".`
                  : "No open auctions yet."}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
