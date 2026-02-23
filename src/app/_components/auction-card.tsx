"use client";

import Image from "next/image";

import { type RouterOutputs } from "~/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export function AuctionCard({ auction }: { auction: OpenAuction }) {
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
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Minimum increment {currencyFormatter.format(auction.minIncrementCents / 100)}
        </p>
      </CardFooter>
    </Card>
  );
}
