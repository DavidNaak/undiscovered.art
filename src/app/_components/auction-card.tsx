"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { type RouterOutputs, api } from "~/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
    <Card className="overflow-hidden">
      <Image
        src={imageSrc}
        alt={auction.title}
        className="h-48 w-full object-cover"
        width={640}
        height={480}
      />
      <CardHeader>
        <CardTitle>{auction.title}</CardTitle>
        <CardDescription>by {auction.seller.name ?? "Unknown artist"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {auction.description ? (
          <p className="line-clamp-2 text-muted-foreground">{auction.description}</p>
        ) : null}
        <p>
          Current bid:{" "}
          <span className="font-medium">
            {currencyFormatter.format(auction.currentPriceCents / 100)}
          </span>
        </p>
        <p className="text-muted-foreground">
          Ends{" "}
          <time dateTime={auction.endsAt.toISOString()} suppressHydrationWarning>
            {formatDate(auction.endsAt)}
          </time>
        </p>
        <p className="text-muted-foreground">
          Next minimum bid {currencyFormatter.format(minimumNextBidCents / 100)}
        </p>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <p className="text-xs text-muted-foreground">
          Minimum increment {currencyFormatter.format(auction.minIncrementCents / 100)}
        </p>
        {!isSignedIn ? (
          <p className="text-xs text-muted-foreground">Sign in to place bids.</p>
        ) : isSeller ? (
          <p className="text-xs text-muted-foreground">You listed this auction.</p>
        ) : (
          <form className="space-y-2" onSubmit={handlePlaceBid}>
            <div className="flex items-center gap-2">
              <Input
                value={bidAmount}
                onChange={(event) => setBidAmount(event.target.value)}
                placeholder={String(minimumNextBidCents / 100)}
                inputMode="decimal"
                disabled={placeBid.isPending}
              />
              <Button type="submit" disabled={placeBid.isPending}>
                {placeBid.isPending ? "Confirming..." : "Place bid"}
              </Button>
            </div>
            {bidError ? <p className="text-xs text-red-500">{bidError}</p> : null}
            {bidSuccess ? (
              <p className="text-xs text-emerald-600">{bidSuccess}</p>
            ) : null}
          </form>
        )}
      </CardFooter>
    </Card>
  );
}
