"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Gavel, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { getAuctionCategoryLabel } from "~/lib/auctions/categories";
import { api } from "~/trpc/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type OpenAuction } from "./auction-types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
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

function getCategoryColorClass(categoryLabel: string): string {
  const map: Record<string, string> = {
    Painting: "bg-amber-100/90 text-amber-800",
    Sculpture: "bg-emerald-100/90 text-emerald-800",
    Photography: "bg-sky-100/90 text-sky-800",
    "Digital Art": "bg-rose-100/90 text-rose-800",
    "Mixed Media": "bg-orange-100/90 text-orange-800",
    Drawing: "bg-indigo-100/90 text-indigo-800",
  };

  return map[categoryLabel] ?? "bg-secondary text-secondary-foreground";
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
  const categoryLabel = getAuctionCategoryLabel(auction.category);
  const minimumNextBidCents = auction.currentPriceCents + auction.minIncrementCents;
  const parsedBidAmountCents = parseUsdToCents(bidAmount);
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
  const canPlaceBid =
    parsedBidAmountCents !== null &&
    parsedBidAmountCents >= minimumNextBidCents &&
    !placeBid.isPending;

  function handlePlaceBid() {
    setErrorMessage(null);
    const amountCents = parsedBidAmountCents;

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
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[20px] border-border p-0 sm:max-w-6xl">
        <div className="flex flex-col sm:flex-row">
          <div className="relative aspect-[4/5] w-full bg-secondary sm:w-[42%] sm:shrink-0">
            <Image
              src={imageSrc}
              alt={auction.title}
              fill
              className="object-cover sm:rounded-l-[20px]"
              sizes="(max-width: 640px) 100vw, 42vw"
            />

            {!timeRemaining.isEnded ? (
              <div className="absolute top-4 left-4">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm",
                    timeRemaining.isUrgent
                      ? "bg-red-100/90 text-red-700"
                      : "bg-card/85 text-foreground",
                  )}
                >
                  <Clock className="size-3.5" />
                  {timeRemaining.text}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col gap-4 p-6">
            <div>
              <Badge
                className={cn(
                  "rounded-md border-none px-3 py-1 text-xs font-medium",
                  getCategoryColorClass(categoryLabel),
                )}
              >
                {categoryLabel}
              </Badge>
              <h2 className="font-serif mt-3 text-2xl font-bold text-balance">
                {auction.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                by{" "}
                <Link
                  href={`/profile/${auction.seller.id}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {auction.seller.name ?? "Unknown artist"}
                </Link>
              </p>
              <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                {auction.description ?? "No description provided."}
              </p>
            </div>

            <div className="h-px w-full bg-border" />

            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-widest">
                Current Bid
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="font-serif text-3xl font-bold">
                  {currencyFormatter.format(auction.currentPriceCents / 100)}
                </p>
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Gavel className="size-4" />
                  {auction.bidCount} bids
                </p>
              </div>
            </div>

            {isSignedIn && !isSeller && !timeRemaining.isEnded ? (
              <div className="space-y-2">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <TrendingUp className="size-3.5" />
                  Min. {currencyFormatter.format(minimumNextBidCents / 100)}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    placeholder={String(minimumNextBidCents / 100)}
                    min={minimumNextBidCents / 100}
                    step="1"
                    disabled={placeBid.isPending}
                    className="h-11 rounded-lg border-accent/65 text-base focus-visible:ring-accent/40"
                  />
                  <Button
                    disabled={!canPlaceBid}
                    className="h-11 rounded-lg bg-foreground px-6 font-semibold text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
                    onClick={handlePlaceBid}
                  >
                    {placeBid.isPending ? "Bidding..." : "Bid"}
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

            <div className="mt-auto flex gap-2">
              <Button
                variant="outline"
                className="h-11 w-full rounded-lg border-border bg-background font-semibold hover:border-accent hover:bg-accent hover:text-foreground"
                render={<Link href={`/auctions/${auction.id}`} />}
                onClick={() => onOpenChange(false)}
              >
                View Full Auction
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
