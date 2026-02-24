"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Gavel, Ruler, Tag, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { getAuctionCategoryLabel } from "~/lib/auctions/categories";
import { getAuctionConditionLabel } from "~/lib/auctions/conditions";
import { api } from "~/trpc/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type OpenAuction } from "./auction-types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getTimeRemaining(endsAt: Date): { text: string; isEnded: boolean; isUrgent: boolean } {
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return { text: "Ended", isEnded: true, isUrgent: false };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    return { text: `${Math.floor(hours / 24)}d ${hours % 24}h`, isEnded: false, isUrgent: false };
  }
  return { text: `${hours}h ${minutes}m`, isEnded: false, isUrgent: hours < 2 };
}

function parseUsdToCents(rawValue: string): number | null {
  const normalized = rawValue.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents)) return null;
  return cents;
}

export function AuctionQuickViewDialog({
  auction,
  currentUserId,
  open,
  onOpenChange,
}: {
  auction: OpenAuction;
  currentUserId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [bidAmount, setBidAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const imageSrc = auction.imageUrl ?? "/auction-placeholder.svg";
  const minimumNextBidCents = auction.currentPriceCents + auction.minIncrementCents;
  const isSignedIn = Boolean(currentUserId);
  const isSeller = currentUserId === auction.seller.id;
  const timeRemaining = useMemo(() => getTimeRemaining(auction.endsAt), [auction.endsAt]);

  const placeBid = api.auction.placeBid.useMutation({
    onError: (error) => {
      setErrorMessage(error.message);
    },
    onSuccess: async () => {
      setBidAmount("");
      setErrorMessage(null);
      onOpenChange(false);
      await utils.auction.listOpen.invalidate();
      router.refresh();
    },
  });

  function handlePlaceBid() {
    setErrorMessage(null);
    const amountCents = parseUsdToCents(bidAmount);

    if (amountCents === null) {
      setErrorMessage("Enter a valid bid amount (e.g. 120 or 120.50).");
      return;
    }

    if (amountCents < minimumNextBidCents) {
      setErrorMessage(
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/80 px-5 py-4 pr-12">
          <DialogTitle className="font-serif text-xl">Quick View</DialogTitle>
          <DialogDescription>
            Preview auction details and place a bid without leaving the grid.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[42%_58%]">
          <div className="relative aspect-[4/5] bg-secondary md:aspect-auto">
            <Image
              src={imageSrc}
              alt={auction.title}
              fill
              className="object-cover md:rounded-bl-[28px]"
              sizes="(max-width: 768px) 100vw, 42vw"
            />
          </div>

          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {getAuctionCategoryLabel(auction.category)}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    timeRemaining.isUrgent
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-border",
                  )}
                >
                  <Clock className="mr-1 size-3" />
                  {timeRemaining.text}
                </Badge>
              </div>
              <h2 className="font-serif text-2xl font-semibold text-balance">{auction.title}</h2>
              <p className="text-muted-foreground text-sm">
                by{" "}
                <Link
                  href={`/profile/${auction.seller.id}`}
                  className="text-foreground font-medium underline-offset-2 hover:underline"
                  onClick={() => onOpenChange(false)}
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

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-border px-3 py-2.5">
                <p className="text-muted-foreground text-xs">Medium</p>
                <p className="text-sm font-medium">{getAuctionCategoryLabel(auction.category)}</p>
              </div>
              <div className="rounded-xl border border-border px-3 py-2.5">
                <p className="text-muted-foreground text-xs">Dimensions</p>
                <p className="text-sm font-medium">{auction.dimensions ?? "Not specified"}</p>
              </div>
              <div className="rounded-xl border border-border px-3 py-2.5">
                <p className="text-muted-foreground text-xs">Year</p>
                <p className="text-sm font-medium">{auction.artworkYear ?? "Not specified"}</p>
              </div>
              <div className="rounded-xl border border-border px-3 py-2.5">
                <p className="text-muted-foreground text-xs">Condition</p>
                <p className="text-sm font-medium">
                  {getAuctionConditionLabel(auction.condition)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Current Bid
              </p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className="font-serif text-3xl font-semibold">
                  {currencyFormatter.format(auction.currentPriceCents / 100)}
                </p>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Gavel className="size-3" />
                  {auction.bidCount} bids
                </p>
              </div>
            </div>

            {isSignedIn && !isSeller && !timeRemaining.isEnded ? (
              <div className="space-y-2">
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <TrendingUp className="size-3.5" />
                  Minimum bid {currencyFormatter.format(minimumNextBidCents / 100)}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    placeholder={String(minimumNextBidCents / 100)}
                    inputMode="decimal"
                    disabled={placeBid.isPending}
                    className="h-11 rounded-lg"
                  />
                  <Button
                    disabled={placeBid.isPending}
                    className="h-11 rounded-lg bg-foreground text-background hover:bg-foreground/90"
                    onClick={handlePlaceBid}
                  >
                    {placeBid.isPending ? "Confirming..." : "Place Bid"}
                  </Button>
                </div>
                {errorMessage ? <p className="text-xs text-red-500">{errorMessage}</p> : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                {!isSignedIn
                  ? "Sign in to place bids."
                  : isSeller
                    ? "You listed this auction."
                    : "Auction is no longer open for bidding."}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10 flex-1 rounded-lg"
                render={<Link href={`/profile/${auction.seller.id}`} />}
                onClick={() => onOpenChange(false)}
              >
                <Tag className="size-4" />
                View Profile
              </Button>
              <Button
                className="h-10 flex-1 rounded-lg bg-foreground text-background hover:bg-foreground/90"
                render={<Link href={`/auctions/${auction.id}`} />}
                onClick={() => onOpenChange(false)}
              >
                <Ruler className="size-4" />
                Full Auction
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
