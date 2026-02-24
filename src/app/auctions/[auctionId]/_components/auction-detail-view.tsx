import Image from "next/image";
import Link from "next/link";
import { Clock, ExternalLink, UserRound } from "lucide-react";

import { getAuctionCategoryLabel, type AuctionCategoryValue } from "~/lib/auctions/categories";
import { getPublicImageUrl } from "~/server/storage/supabase";
import { cn } from "@/lib/utils";

import { AuctionDetailBidForm } from "./auction-detail-bid-form";
import { AuctionDetailTabs } from "./auction-detail-tabs";

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
  const disabledReason = !currentUserId
    ? "Sign in to place bids."
    : currentUserId === auction.seller.id
      ? "You listed this auction."
      : "Auction is no longer open for bidding.";

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
          <div className="relative overflow-hidden rounded-2xl border border-border bg-secondary/60">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-card/90 text-foreground absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium backdrop-blur-sm transition hover:bg-card"
            >
              <ExternalLink className="size-3.5" />
              Open original
            </a>
            <div className="relative aspect-[4/5]">
              <Image
                src={imageUrl}
                alt={auction.title}
                fill
                className="object-contain"
                sizes="(max-width: 1024px) 100vw, 52vw"
                priority
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Full image preview shown here. Use <span className="font-medium">Open original</span>{" "}
            for native zoom.
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                {getAuctionCategoryLabel(auction.category)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  timeRemaining.isEnded
                    ? "bg-muted text-muted-foreground"
                    : timeRemaining.isUrgent
                      ? "bg-rose-100 text-rose-700"
                      : "bg-secondary text-foreground/80",
                )}
              >
                <Clock className="size-3.5" />
                {timeRemaining.isEnded ? "Ended" : `${timeRemaining.text} left`}
              </span>
            </div>
            <h1 className="font-serif text-balance text-3xl leading-tight font-bold lg:text-4xl">
              {auction.title}
            </h1>

            <div className="flex items-center gap-2">
              <div className="bg-accent/20 text-accent flex size-7 shrink-0 items-center justify-center rounded-full">
                <UserRound className="size-3.5" />
              </div>
              <p className="text-base text-muted-foreground">
                by{" "}
                <Link
                  href={`/profile/${auction.seller.id}`}
                  className="font-medium text-foreground transition-colors hover:text-accent"
                >
                  {auction.seller.name ?? "Unknown artist"}
                </Link>
              </p>
            </div>

            <div className="h-px w-full bg-border/90" />
          </div>

          <AuctionDetailBidForm
            auctionId={auction.id}
            currentPriceCents={auction.currentPriceCents}
            minIncrementCents={auction.minIncrementCents}
            bidCount={auction.bidCount}
            isLive={auction.status === "LIVE" && !timeRemaining.isEnded}
            canBid={canBid}
            disabledReason={canBid ? null : disabledReason}
          />

          <AuctionDetailTabs
            description={auction.description}
            category={auction.category}
            dimensions={auction.dimensions}
            artworkYear={auction.artworkYear}
            condition={auction.condition}
            bidHistory={bidHistory}
            bidCount={auction.bidCount}
          />
        </div>
      </div>
    </div>
  );
}
