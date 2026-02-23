"use client";

import { api } from "~/trpc/react";

import { AuctionGrid } from "./auction-grid";
import { CreateAuctionForm } from "./create-auction-form";

export function AuctionHouse({ canCreate }: { canCreate: boolean }) {
  const { data: openAuctions = [] } = api.auction.listOpen.useQuery();

  return (
    <div
      className={
        canCreate
          ? "grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]"
          : "grid gap-8 lg:grid-cols-1"
      }
    >
      <CreateAuctionForm canCreate={canCreate} />
      <AuctionGrid auctions={openAuctions} />
    </div>
  );
}
