"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, Eye, Gavel } from "lucide-react";
import { useMemo, useState } from "react";

import { getAuctionCategoryLabel } from "~/lib/auctions/categories";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { AuctionQuickViewDialog } from "./auction-quick-view-dialog";
import { type OpenAuction } from "./auction-types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getTimeRemaining(endsAt: Date): string {
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return "Ended";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

export function AuctionCard({
  auction,
  currentUserId,
}: {
  auction: OpenAuction;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  const imageSrc = auction.imageUrl ?? "/auction-placeholder.svg";
  const timeRemaining = useMemo(() => getTimeRemaining(auction.endsAt), [auction.endsAt]);
  const isUrgent =
    timeRemaining !== "Ended" &&
    /\d+h/.test(timeRemaining) &&
    Number.parseInt(timeRemaining, 10) < 2;

  const handleOpenFullAuction = () => {
    router.push(`/auctions/${auction.id}`);
  };

  return (
    <>
      <Card
        className="group overflow-hidden border-border/90 bg-card pt-0 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
        role="button"
        tabIndex={0}
        onClick={handleOpenFullAuction}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleOpenFullAuction();
          }
        }}
      >
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

          <div
            className="flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Button
              variant="outline"
              className="h-10 flex-1 rounded-lg"
              onClick={() => setIsQuickViewOpen(true)}
            >
              <Eye className="size-4" />
              Quick View
            </Button>
            <Button
              className="h-10 flex-1 rounded-lg bg-foreground text-background hover:bg-foreground/90"
              onClick={handleOpenFullAuction}
            >
              View Auction
            </Button>
          </div>
        </CardContent>
      </Card>

      <AuctionQuickViewDialog
        auction={auction}
        currentUserId={currentUserId}
        open={isQuickViewOpen}
        onOpenChange={setIsQuickViewOpen}
      />
    </>
  );
}
