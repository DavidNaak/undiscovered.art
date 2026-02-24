"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, Gavel, TrendingUp } from "lucide-react";

import { getAuctionCategoryLabel } from "~/lib/auctions/categories";
import { type RouterOutputs, api } from "~/trpc/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type OpenAuction = RouterOutputs["auction"]["listOpen"][number];

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

function getTimeRemaining(endsAt: Date): string {
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return "Ended";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

function parseUsdToCents(rawValue: string): number | null {
  const normalized = rawValue.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents)) return null;
  return cents;
}

export function AuctionCard({
  auction,
  currentUserId,
}: {
  auction: OpenAuction;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [bidAmount, setBidAmount] = useState("");
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  const minimumNextBidCents = auction.currentPriceCents + auction.minIncrementCents;
  const isSignedIn = Boolean(currentUserId);
  const isSeller = currentUserId === auction.seller.id;
  const imageSrc = auction.imageUrl ?? "/auction-placeholder.svg";
  const timeRemaining = getTimeRemaining(auction.endsAt);
  const isUrgent = timeRemaining !== "Ended" && /\d+h/.test(timeRemaining) && Number.parseInt(timeRemaining, 10) < 2;

  const placeBid = api.auction.placeBid.useMutation({
    onError: (error) => {
      setBidError(error.message);
    },
    onSuccess: async () => {
      setBidSuccess("Bid placed.");
      setBidAmount("");
      await utils.auction.listOpen.invalidate();
      router.refresh();
    },
  });

  function handlePlaceBid(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBidError(null);
    setBidSuccess(null);

    const amountCents = parseUsdToCents(bidAmount);
    if (amountCents === null) {
      setBidError("Enter a valid bid amount (e.g. 120 or 120.50).");
      return;
    }
    if (amountCents < minimumNextBidCents) {
      setBidError(
        `Bid must be at least ${currencyFormatter.format(minimumNextBidCents / 100)}.`,
      );
      return;
    }

    placeBid.mutate({
      auctionId: auction.id,
      amountCents,
    });
  }

  return (
    <Card className="group overflow-hidden border-border/90 bg-card pt-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        <Image
          src={imageSrc}
          alt={auction.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          width={640}
          height={800}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute top-3 right-3 left-3 flex items-start justify-between">
          <Badge variant="outline" className="bg-card/90 text-foreground border-border px-2.5 py-1">
            {getAuctionCategoryLabel(auction.category)}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 border px-2.5 py-1 backdrop-blur-sm",
              isUrgent
                ? "border-red-200 bg-red-50/90 text-red-700"
                : "bg-card/90 text-foreground border-border",
            )}
          >
            <Clock className="size-3" />
            {timeRemaining}
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <h3 className="font-serif text-xl font-semibold leading-tight">{auction.title}</h3>
          <p className="text-muted-foreground text-sm">
            by {auction.seller.name ?? "Unknown artist"}
          </p>
        </div>

        {auction.description ? (
          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {auction.description}
          </p>
        ) : null}

        <div className="flex items-end justify-between gap-2 border-t border-border pt-3">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Current Bid</p>
            <p className="font-serif text-2xl font-semibold">
              {currencyFormatter.format(auction.currentPriceCents / 100)}
            </p>
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Gavel className="size-3.5" />
            <span>{auction.bidCount} bids</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <TrendingUp className="size-3" />
            <span>
              Min next bid {currencyFormatter.format(minimumNextBidCents / 100)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Ends{" "}
            <time dateTime={auction.endsAt.toISOString()} suppressHydrationWarning>
              {formatDate(auction.endsAt)}
            </time>
          </p>
        </div>

        {!isSignedIn ? (
          <p className="text-muted-foreground text-xs">Sign in to place bids.</p>
        ) : isSeller ? (
          <p className="text-muted-foreground text-xs">You listed this auction.</p>
        ) : (
          <form className="space-y-2" onSubmit={handlePlaceBid}>
            <div className="flex items-center gap-2">
              <Input
                value={bidAmount}
                onChange={(event) => setBidAmount(event.target.value)}
                placeholder={String(minimumNextBidCents / 100)}
                inputMode="decimal"
                disabled={placeBid.isPending}
                className="h-10 rounded-lg"
              />
              <Button
                type="submit"
                disabled={placeBid.isPending}
                className="h-10 rounded-lg bg-foreground text-background hover:bg-foreground/90"
              >
                {placeBid.isPending ? "Confirming..." : "Place Bid"}
              </Button>
            </div>
            {bidError ? <p className="text-xs text-red-500">{bidError}</p> : null}
            {bidSuccess ? <p className="text-xs text-emerald-600">{bidSuccess}</p> : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
