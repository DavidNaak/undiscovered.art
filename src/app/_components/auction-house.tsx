"use client";

import { api } from "~/trpc/react";

import { AuctionGrid } from "./auction-grid";
import { CreateAuctionForm } from "./create-auction-form";

export function AuctionHouse({
  canCreate,
  currentUserId,
  searchQuery,
}: {
  canCreate: boolean;
  currentUserId: string | null;
  searchQuery?: string;
}) {
  const { data: openAuctions = [] } = api.auction.listOpen.useQuery(
    searchQuery ? { query: searchQuery } : undefined,
    {
      refetchInterval: 2_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  );

  return (
    <div
      className={
        canCreate
          ? "grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]"
          : "grid gap-8 lg:grid-cols-1"
      }
    >
      <CreateAuctionForm canCreate={canCreate} />
      <AuctionGrid
        auctions={openAuctions}
        currentUserId={currentUserId}
        searchQuery={searchQuery}
      />
    </div>
  );
}
