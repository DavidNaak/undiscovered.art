"use client";

import { useState } from "react";
import Image from "next/image";

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
  const utils = api.useUtils();
  const [bidAmount, setBidAmount] = useState("");
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  const minimumNextBidCents = auction.currentPriceCents + auction.minIncrementCents;
  const isSignedIn = Boolean(currentUserId);
  const isSeller = currentUserId === auction.seller.id;

  const placeBid = api.auction.placeBid.useMutation({
    onMutate: async (input) => {
      setBidError(null);
      setBidSuccess(null);

      await utils.auction.listOpen.cancel();
      const previousAuctions = utils.auction.listOpen.getData();

      utils.auction.listOpen.setData(undefined, (currentAuctions) =>
        currentAuctions?.map((openAuction) =>
          openAuction.id === auction.id
            ? { ...openAuction, currentPriceCents: input.amountCents }
            : openAuction,
        ),
      );

      return { previousAuctions };
    },
    onError: (error, _input, context) => {
      if (context?.previousAuctions) {
        utils.auction.listOpen.setData(undefined, context.previousAuctions);
      }
      setBidError(error.message);
    },
    onSuccess: () => {
      setBidSuccess("Bid placed.");
      setBidAmount("");
    },
    onSettled: async () => {
      await utils.auction.listOpen.invalidate();
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
      {auction.imageUrl ? (
        <Image
          src={auction.imageUrl}
          alt={auction.title}
          className="h-48 w-full object-cover"
          width={640}
          height={480}
        />
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          No image
        </div>
      )}
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
        <p className="text-muted-foreground">Ends {formatDate(auction.endsAt)}</p>
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
                {placeBid.isPending ? "Placing..." : "Place bid"}
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
