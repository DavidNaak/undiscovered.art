"use client";

import { useRouter } from "next/navigation";
import { Gavel, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "~/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function parseUsdToCents(rawValue: string): number | null {
  const normalized = rawValue.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents)) return null;
  return cents;
}

function formatCentsForInput(cents: number): string {
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2);
}

export function AuctionDetailBidForm({
  auctionId,
  currentPriceCents,
  minIncrementCents,
  bidCount,
  isLive,
  canBid,
  disabledReason,
}: {
  auctionId: string;
  currentPriceCents: number;
  minIncrementCents: number;
  bidCount: number;
  isLive: boolean;
  canBid: boolean;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [bidAmount, setBidAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const minimumNextBidCents = currentPriceCents + minIncrementCents;
  const parsedBidAmountCents = parseUsdToCents(bidAmount);
  const quickBidAmounts = [
    minimumNextBidCents,
    minimumNextBidCents + minIncrementCents,
    minimumNextBidCents + minIncrementCents * 2,
  ];

  const placeBid = api.auction.placeBid.useMutation({
    onError: (error) => {
      setErrorMessage(error.message);
    },
    onSuccess: async (placedBid) => {
      setBidAmount("");
      setErrorMessage(null);
      toast.success("Bid placed", {
        description: `Your bid of ${currencyFormatter.format(placedBid.amountCents / 100)} is now leading.`,
      });
      await utils.auction.listOpen.invalidate();
      router.refresh();
    },
  });
  const canPlaceBid =
    canBid &&
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
      auctionId,
      amountCents,
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-secondary/50 p-5">
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {isLive ? "Current Bid" : "Final Price"}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-serif text-4xl font-bold text-foreground">
          {currencyFormatter.format(currentPriceCents / 100)}
        </p>
        <div className="text-muted-foreground inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm">
          <Gavel className="size-4" />
          <span>{bidCount} bids</span>
        </div>
      </div>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <TrendingUp className="size-3.5" />
        Minimum bid: {currencyFormatter.format(minimumNextBidCents / 100)} (increment:{" "}
        {currencyFormatter.format(minIncrementCents / 100)})
      </p>

      <div className="flex items-center gap-2">
        <Input
          value={bidAmount}
          onChange={(event) => setBidAmount(event.target.value)}
          placeholder={formatCentsForInput(minimumNextBidCents)}
          inputMode="decimal"
          type="text"
          disabled={placeBid.isPending || !canBid}
          className="h-12 flex-1 rounded-lg text-base"
        />
        <Button
          disabled={!canPlaceBid}
          className="h-12 rounded-lg bg-foreground px-8 text-base font-semibold text-background hover:bg-foreground/90"
          onClick={handlePlaceBid}
        >
          {placeBid.isPending ? "Confirming..." : "Place Bid"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {quickBidAmounts.map((amountCents) => {
          const isSelected = parsedBidAmountCents === amountCents;

          return (
            <Button
              key={amountCents}
              type="button"
              variant="outline"
              disabled={placeBid.isPending || !canBid}
              className={cn(
                "h-10 rounded-md border-border py-2 text-sm font-medium text-muted-foreground hover:border-accent hover:text-accent",
                isSelected && "border-accent bg-accent/5 text-accent",
              )}
              onClick={() => {
                setErrorMessage(null);
                setBidAmount(formatCentsForInput(amountCents));
              }}
            >
              {currencyFormatter.format(amountCents / 100)}
            </Button>
          );
        })}
      </div>

      {errorMessage ? <p className="text-xs text-red-500">{errorMessage}</p> : null}
      {!canBid && disabledReason ? (
        <p className="text-muted-foreground text-sm">{disabledReason}</p>
      ) : null}
    </div>
  );
}
