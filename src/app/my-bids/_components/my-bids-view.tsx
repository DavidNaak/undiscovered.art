"use client";

import Image from "next/image";
import Link from "next/link";
import { Filter, Gavel, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type BidStatus = "LEADING" | "OUTBID" | "WON" | "LOST" | "CANCELLED";

type MyBidItem = {
  auctionId: string;
  title: string;
  sellerId: string;
  sellerName: string;
  imageUrl: string | null;
  categoryLabel: string;
  yourBidCents: number;
  currentBidCents: number;
  endsAtIso: string;
  totalBids: number;
  status: BidStatus;
};

const FILTER_TABS: Array<{ label: string; value: "ALL" | BidStatus }> = [
  { label: "All Bids", value: "ALL" },
  { label: "Leading", value: "LEADING" },
  { label: "Outbid", value: "OUTBID" },
  { label: "Won", value: "WON" },
  { label: "Lost", value: "LOST" },
  { label: "Cancelled", value: "CANCELLED" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusConfig(status: BidStatus) {
  if (status === "LEADING") {
    return {
      label: "Leading",
      icon: TrendingUp,
      className: "bg-emerald-100 text-emerald-800",
    };
  }
  if (status === "OUTBID") {
    return {
      label: "Outbid",
      icon: TrendingDown,
      className: "bg-amber-100 text-amber-800",
    };
  }
  if (status === "WON") {
    return {
      label: "Won",
      icon: Trophy,
      className: "bg-indigo-100 text-indigo-800",
    };
  }
  if (status === "LOST") {
    return {
      label: "Lost",
      icon: Gavel,
      className: "bg-secondary text-muted-foreground",
    };
  }
  return {
    label: "Cancelled",
    icon: Gavel,
    className: "bg-red-100 text-red-700",
  };
}

export function MyBidsView({
  bids,
}: {
  bids: MyBidItem[];
}) {
  const [activeFilter, setActiveFilter] = useState<"ALL" | BidStatus>("ALL");

  const counts = useMemo(() => {
    return {
      ALL: bids.length,
      LEADING: bids.filter((bid) => bid.status === "LEADING").length,
      OUTBID: bids.filter((bid) => bid.status === "OUTBID").length,
      WON: bids.filter((bid) => bid.status === "WON").length,
      LOST: bids.filter((bid) => bid.status === "LOST").length,
      CANCELLED: bids.filter((bid) => bid.status === "CANCELLED").length,
    };
  }, [bids]);

  const filteredBids = useMemo(() => {
    if (activeFilter === "ALL") return bids;
    return bids.filter((bid) => bid.status === activeFilter);
  }, [activeFilter, bids]);

  const wonTotal = useMemo(
    () =>
      bids
        .filter((bid) => bid.status === "WON")
        .reduce((sum, bid) => sum + bid.yourBidCents, 0),
    [bids],
  );

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="font-serif text-4xl font-semibold">My Bids</h1>
        <p className="text-muted-foreground text-sm">
          Track active bids, outcomes, and your recent auction participation.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-widest">Active</p>
            <p className="font-serif text-2xl font-semibold">{counts.LEADING + counts.OUTBID}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-widest">Leading</p>
            <p className="font-serif text-2xl font-semibold">{counts.LEADING}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-widest">Won</p>
            <p className="font-serif text-2xl font-semibold">{counts.WON}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-widest">Won Value</p>
            <p className="font-serif text-2xl font-semibold">
              {currencyFormatter.format(wonTotal / 100)}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="flex items-center gap-3 overflow-x-auto pb-1">
        <Filter className="text-muted-foreground size-4 shrink-0" />
        <div className="flex items-center gap-2">
          {FILTER_TABS.map((tab) => {
            const count = counts[tab.value];
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveFilter(tab.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  activeFilter === tab.value
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                    activeFilter === tab.value
                      ? "bg-background/20 text-background"
                      : "bg-foreground/10 text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        {filteredBids.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground text-sm">
                No bids in this filter yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredBids.map((bid) => {
            const status = statusConfig(bid.status);
            const StatusIcon = status.icon;
            return (
              <article
                key={`${bid.auctionId}-${bid.status}`}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-md sm:flex-row"
              >
                <div className="relative aspect-[4/3] w-full shrink-0 bg-secondary sm:aspect-square sm:w-44">
                  {bid.imageUrl ? (
                    <Image
                      src={bid.imageUrl}
                      alt={bid.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 176px"
                    />
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn("gap-1.5", status.className)}>
                      <StatusIcon className="size-3" />
                      {status.label}
                    </Badge>
                    <Badge variant="outline">{bid.categoryLabel}</Badge>
                  </div>

                  <div>
                    <h2 className="font-serif text-xl font-semibold">{bid.title}</h2>
                    <p className="text-muted-foreground text-sm">
                      by{" "}
                      <Link href={`/profile/${bid.sellerId}`} className="hover:underline">
                        {bid.sellerName}
                      </Link>
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap items-end gap-5 border-t border-border pt-3">
                    <div>
                      <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
                        Your Bid
                      </p>
                      <p className="font-serif text-xl font-semibold">
                        {currencyFormatter.format(bid.yourBidCents / 100)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
                        {bid.status === "WON" || bid.status === "LOST" ? "Final Price" : "Current Bid"}
                      </p>
                      <p className="font-serif text-xl font-semibold">
                        {currencyFormatter.format(bid.currentBidCents / 100)}
                      </p>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      <p>{bid.totalBids} bids</p>
                      <p>Ends {formatDate(bid.endsAtIso)}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="rounded-full"
                        render={<Link href={`/profile/${bid.sellerId}`} />}
                      >
                        View Profile
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-full"
                        render={<Link href={`/auctions/${bid.auctionId}`} />}
                      >
                        View Auction
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
