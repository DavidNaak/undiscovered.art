"use client";

import { useEffect, useMemo, useState } from "react";

import { AUCTION_CATEGORY_OPTIONS, type AuctionCategoryValue } from "~/lib/auctions/categories";
import { type AuctionSortBy } from "~/lib/auctions/schema";
import { api } from "~/trpc/react";

import { AuctionGrid } from "./auction-grid";
import { CreateAuctionForm } from "./create-auction-form";
import { SearchFilterBar } from "./search-filter-bar";
import { type OpenAuction } from "./auction-types";

export function AuctionHouse({
  canCreate,
  currentUserId,
}: {
  canCreate: boolean;
  currentUserId: string | null;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<"ALL" | AuctionCategoryValue>("ALL");
  const [sortBy, setSortBy] = useState<AuctionSortBy>("ending-soon");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const listOpenInput = useMemo(
    () => ({
      query: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      category: activeCategory === "ALL" ? undefined : activeCategory,
      sortBy,
    }),
    [activeCategory, debouncedSearch, sortBy],
  );

  const auctionListQuery = api.auction.listOpen.useQuery(
    listOpenInput,
    {
      refetchInterval: 2_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  );
  const openAuctions: OpenAuction[] = auctionListQuery.data ?? [];
  const isInitialLoading =
    auctionListQuery.isLoading ||
    (auctionListQuery.isFetching && auctionListQuery.data === undefined);
  const resultCount = auctionListQuery.data ? auctionListQuery.data.length : null;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 pb-1 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="font-serif text-5xl font-semibold tracking-tight">Open Auctions</h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Discover and bid on artwork from emerging artists worldwide.
          </p>
        </div>

        <CreateAuctionForm canCreate={canCreate} />
      </section>

      <SearchFilterBar
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        sortBy={sortBy}
        onSortChange={setSortBy}
        resultCount={resultCount}
        categories={AUCTION_CATEGORY_OPTIONS}
      />

      <AuctionGrid
        auctions={openAuctions}
        isLoading={isInitialLoading}
        currentUserId={currentUserId}
        activeCategory={activeCategory}
        debouncedSearch={debouncedSearch}
      />
    </div>
  );
}
