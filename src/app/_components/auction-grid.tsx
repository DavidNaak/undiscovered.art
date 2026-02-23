"use client";

import { type RouterOutputs } from "~/trpc/react";
import { Card, CardContent } from "@/components/ui/card";

import { AuctionCard } from "./auction-card";

type OpenAuction = RouterOutputs["auction"]["listOpen"];

export function AuctionGrid({ auctions }: { auctions: OpenAuction }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Open Auctions</h2>
        <p className="text-sm text-muted-foreground">
          Freshly listed artwork available for bidding.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {auctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
        ))}
        {auctions.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent>
              <p className="text-sm text-muted-foreground">No open auctions yet.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
