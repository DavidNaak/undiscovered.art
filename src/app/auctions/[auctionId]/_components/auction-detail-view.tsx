import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Info, Ruler, Tag } from "lucide-react";

import { getAuctionCategoryLabel, type AuctionCategoryValue } from "~/lib/auctions/categories";
import { getAuctionConditionLabel } from "~/lib/auctions/conditions";
import { getPublicImageUrl } from "~/server/storage/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AuctionDetailBidForm } from "./auction-detail-bid-form";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getTimeRemaining(endsAt: Date): { text: string; isEnded: boolean; isUrgent: boolean } {
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return { text: "Ended", isEnded: true, isUrgent: false };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return { text: `${Math.floor(hours / 24)}d ${hours % 24}h`, isEnded: false, isUrgent: false };
  return { text: `${hours}h ${minutes}m`, isEnded: false, isUrgent: hours < 2 };
}

type AuctionDetailSeller = {
  id: string;
  name: string | null;
  image: string | null;
};

type AuctionDetailBid = {
  id: string;
  bidderId: string;
  amountCents: number;
  createdAt: Date;
  bidderName: string | null;
};

type AuctionDetailAuction = {
  id: string;
  title: string;
  description: string | null;
  category: AuctionCategoryValue;
  dimensions: string | null;
  condition: string | null;
  artworkYear: number | null;
  imagePath: string;
  currentPriceCents: number;
  minIncrementCents: number;
  endsAt: Date;
  status: "LIVE" | "ENDED" | "CANCELLED";
  bidCount: number;
  seller: AuctionDetailSeller;
};

export function AuctionDetailView({
  auction,
  bidHistory,
  currentUserId,
}: {
  auction: AuctionDetailAuction;
  bidHistory: AuctionDetailBid[];
  currentUserId: string | null;
}) {
  const imageUrl = getPublicImageUrl(auction.imagePath) ?? "/auction-placeholder.svg";
  const timeRemaining = getTimeRemaining(auction.endsAt);
  const canBid =
    !!currentUserId &&
    currentUserId !== auction.seller.id &&
    auction.status === "LIVE" &&
    !timeRemaining.isEnded;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="text-muted-foreground inline-flex items-center text-sm font-medium hover:text-foreground"
      >
        ← Back to auctions
      </Link>

      <div className="grid gap-8 lg:grid-cols-[52%_48%]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary">
            <div className="relative aspect-[4/5]">
              <Image
                src={imageUrl}
                alt={auction.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 52vw"
                priority
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <Tag className="text-muted-foreground size-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Medium</p>
                <p className="text-sm font-medium">
                  {getAuctionCategoryLabel(auction.category)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <Ruler className="text-muted-foreground size-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Dimensions</p>
                <p className="text-sm font-medium">{auction.dimensions ?? "Not specified"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <Calendar className="text-muted-foreground size-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Year</p>
                <p className="text-sm font-medium">{auction.artworkYear ?? "Not specified"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="bg-secondary flex size-10 items-center justify-center rounded-full">
                <Info className="text-muted-foreground size-4" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Condition</p>
                <p className="text-sm font-medium">
                  {getAuctionConditionLabel(auction.condition)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{getAuctionCategoryLabel(auction.category)}</Badge>
              <Badge variant="outline" className={timeRemaining.isUrgent ? "text-red-600" : ""}>
                <Clock className="mr-1 size-3" />
                {timeRemaining.text}
              </Badge>
            </div>
            <h1 className="font-serif text-4xl font-semibold text-balance">{auction.title}</h1>
            <p className="text-muted-foreground text-sm">
              by{" "}
              <Link
                href={`/profile/${auction.seller.id}`}
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                {auction.seller.name ?? "Unknown artist"}
              </Link>
            </p>
            {auction.description ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {auction.description}
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              {auction.status === "LIVE" ? "Current Bid" : "Final Price"}
            </p>
            <div className="flex items-end justify-between gap-2">
              <p className="font-serif text-4xl font-semibold">
                {currencyFormatter.format(auction.currentPriceCents / 100)}
              </p>
              <p className="text-muted-foreground text-xs">{auction.bidCount} bids</p>
            </div>
            <p className="text-muted-foreground text-xs">
              Ends {formatDate(auction.endsAt)}
            </p>
          </div>

          {canBid ? (
            <AuctionDetailBidForm
              auctionId={auction.id}
              currentPriceCents={auction.currentPriceCents}
              minIncrementCents={auction.minIncrementCents}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {!currentUserId
                ? "Sign in to place bids."
                : currentUserId === auction.seller.id
                  ? "You listed this auction."
                  : "Auction is no longer open for bidding."}
            </p>
          )}

          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <h2 className="font-serif text-lg font-semibold">Bid History</h2>
            {bidHistory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No bids yet.</p>
            ) : (
              <div className="space-y-2">
                {bidHistory.map((bid, index) => (
                  <div
                    key={bid.id}
                    className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        <Link
                          href={`/profile/${bid.bidderId}`}
                          className="hover:underline"
                        >
                          {bid.bidderName ?? "Unknown bidder"}
                        </Link>
                        {index === 0 ? (
                          <span className="text-muted-foreground ml-2 text-xs">Leading</span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground text-xs">{formatDate(bid.createdAt)}</p>
                    </div>
                    <p className="font-serif text-base font-semibold">
                      {currencyFormatter.format(bid.amountCents / 100)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-semibold">
                {auction.seller.name ?? "Unknown artist"}
              </p>
              <p className="text-muted-foreground text-xs">
                Public profile and listings
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              render={<Link href={`/profile/${auction.seller.id}`} />}
            >
              View Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
