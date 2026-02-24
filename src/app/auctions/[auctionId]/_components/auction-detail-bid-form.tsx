"use client";

import { useRouter } from "next/navigation";
import { Gavel, TrendingUp } from "lucide-react";
import { useState } from "react";

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
    onSuccess: async () => {
      setBidAmount("");
      setErrorMessage(null);
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
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
        {isLive ? "Current Bid" : "Final Price"}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-serif text-5xl leading-none font-semibold tracking-tight">
          {currencyFormatter.format(currentPriceCents / 100)}
        </p>
        <div className="text-muted-foreground inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm">
          <Gavel className="size-4" />
          <span>{bidCount} bids</span>
        </div>
      </div>

      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <TrendingUp className="size-4" />
        Minimum bid: {currencyFormatter.format(minimumNextBidCents / 100)} (increment:{" "}
        {currencyFormatter.format(minIncrementCents / 100)})
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={bidAmount}
          onChange={(event) => setBidAmount(event.target.value)}
          placeholder={formatCentsForInput(minimumNextBidCents)}
          inputMode="decimal"
          type="text"
          disabled={placeBid.isPending || !canBid}
          className="h-14 rounded-xl border-border bg-background px-5 text-3xl font-medium tracking-tight sm:flex-1"
        />
        <Button
          disabled={!canPlaceBid}
          className="h-14 rounded-xl bg-foreground px-8 text-xl font-semibold text-background hover:bg-foreground/90 sm:w-auto"
          onClick={handlePlaceBid}
        >
          {placeBid.isPending ? "Confirming..." : "Place Bid"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {quickBidAmounts.map((amountCents) => {
          const isSelected = parsedBidAmountCents === amountCents;

          return (
            <Button
              key={amountCents}
              type="button"
              variant="outline"
              disabled={placeBid.isPending || !canBid}
              className={cn(
                "h-12 rounded-xl border-border bg-background text-3xl font-medium text-muted-foreground hover:border-accent hover:text-accent",
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
