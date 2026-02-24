"use client";

import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { useState } from "react";

import { api } from "~/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function parseUsdToCents(rawValue: string): number | null {
  const normalized = rawValue.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isFinite(cents)) return null;
  return cents;
}

export function AuctionDetailBidForm({
  auctionId,
  currentPriceCents,
  minIncrementCents,
}: {
  auctionId: string;
  currentPriceCents: number;
  minIncrementCents: number;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [bidAmount, setBidAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const minimumNextBidCents = currentPriceCents + minIncrementCents;

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
      auctionId,
      amountCents,
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
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

      {errorMessage ? (
        <p className="text-xs text-red-500">{errorMessage}</p>
      ) : null}
    </div>
  );
}
