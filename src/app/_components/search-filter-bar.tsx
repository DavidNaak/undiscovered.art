"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Search, SlidersHorizontal, X } from "lucide-react";

import { type AuctionCategoryValue } from "~/lib/auctions/categories";
import { auctionSortBySchema, type AuctionSortBy } from "~/lib/auctions/schema";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CategoryOption = {
  value: AuctionCategoryValue;
  label: string;
};

const SORT_OPTIONS: Array<{ value: AuctionSortBy; label: string }> = [
  { value: "ending-soon", label: "Ending Soon" },
  { value: "newest", label: "Newest First" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "most-bids", label: "Most Bids" },
];

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  resultCount,
  categories,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: "ALL" | AuctionCategoryValue;
  onCategoryChange: (category: "ALL" | AuctionCategoryValue) => void;
  sortBy: AuctionSortBy;
  onSortChange: (sort: AuctionSortBy) => void;
  resultCount: number | null;
  categories: CategoryOption[];
}) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={cn(
            "relative flex-1 rounded-xl transition-all duration-200",
            isFocused && "ring-2 ring-accent/35",
          )}
        >
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search by title or description..."
            className="bg-card h-11 rounded-xl border-border pl-10 pr-20"
          />
          <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
            <kbd className="text-muted-foreground hidden h-5 items-center gap-1 rounded border border-border bg-secondary px-1.5 text-[10px] font-medium sm:inline-flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>

        <Select
          value={sortBy}
          onValueChange={(value) => {
            const parsedSort = auctionSortBySchema.safeParse(value);
            if (parsedSort.success) {
              onSortChange(parsedSort.data);
            }
          }}
        >
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-[220px]">
            <ArrowUpDown className="text-muted-foreground size-4" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <SlidersHorizontal className="text-muted-foreground size-4 shrink-0" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCategoryChange("ALL")}
            className={cn(
              "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all",
              activeCategory === "ALL"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.value}
              type="button"
              onClick={() => onCategoryChange(category.value)}
              className={cn(
                "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all",
                activeCategory === category.value
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {resultCount === null ? (
        <p className="text-muted-foreground text-sm">Loading auctions...</p>
      ) : (
        <p className="text-muted-foreground text-sm">
          {resultCount} {resultCount === 1 ? "auction" : "auctions"} found
        </p>
      )}
    </section>
  );
}
