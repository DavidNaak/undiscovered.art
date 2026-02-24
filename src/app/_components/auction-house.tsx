"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { AUCTION_CATEGORY_OPTIONS, type AuctionCategoryValue } from "~/lib/auctions/categories";
import { type AuctionSortBy } from "~/lib/auctions/schema";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/trpc/react";

import { Button } from "@/components/ui/button";
import { AuctionGrid } from "./auction-grid";
import { SearchFilterBar } from "./search-filter-bar";
import { type OpenAuction } from "./auction-types";

export function AuctionHouse() {
  const { data: session } = authClient.useSession();
  const canCreate = Boolean(session?.user);
  const currentUserId = session?.user?.id ?? null;
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

        {canCreate ? (
          <Button
            className="h-12 rounded-full bg-foreground px-7 text-base text-background hover:bg-foreground/90"
            nativeButton={false}
            render={<Link href="/auctions/new" />}
          >
            <Plus className="size-4" />
            Create Auction
          </Button>
        ) : (
          <Button
            className="h-12 rounded-full bg-foreground px-7 text-base text-background hover:bg-foreground/90"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Sign in to create
          </Button>
        )}
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
