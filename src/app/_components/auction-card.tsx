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
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function getTimeRemaining(
  endsAt: Date,
): { label: string; isUrgent: boolean; isEnded: boolean } {
  const diff = endsAt.getTime() - Date.now();
  if (diff <= 0) return { label: "Ended", isUrgent: false, isEnded: true };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    return {
      label: `${Math.floor(hours / 24)}d ${hours % 24}h`,
      isUrgent: false,
      isEnded: false,
    };
  }

  return {
    label: `${hours}h ${minutes}m`,
    isUrgent: hours < 2,
    isEnded: false,
  };
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
  const categoryLabel = getAuctionCategoryLabel(auction.category);
  const timeRemaining = useMemo(() => getTimeRemaining(auction.endsAt), [auction.endsAt]);

  const handleOpenFullAuction = () => {
    router.push(`/auctions/${auction.id}`);
  };

  return (
    <>
      <Card
        className="group relative cursor-pointer overflow-hidden bg-transparent pt-0 shadow-none ring-0 transition-transform duration-300 hover:-translate-y-0.5"
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
        <div className="relative aspect-[4/5] overflow-hidden">
          <div className="absolute inset-0">
            <div className="relative h-full w-full overflow-hidden">
              <Image
                src={imageSrc}
                alt={auction.title}
                fill
                className="object-contain transition-transform duration-700 group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/16 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="absolute top-3 left-3 translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <Badge
              className={cn(
                "w-fit rounded-full border-none px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm",
                getCategoryColorClass(categoryLabel),
              )}
            >
              {categoryLabel}
            </Badge>
          </div>

          <div className="absolute bottom-3 left-3 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5 rounded-full bg-card/90 text-foreground backdrop-blur-sm hover:bg-card"
              onClick={(event) => {
                event.stopPropagation();
                setIsQuickViewOpen(true);
              }}
            >
              <Eye className="size-3.5" />
              Quick View
            </Button>
          </div>

          {timeRemaining.isEnded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/40">
              <span className="rounded-full bg-card px-4 py-2 text-xs font-semibold text-foreground">
                Auction Ended
              </span>
            </div>
          ) : null}
        </div>

        <CardContent className="flex flex-1 flex-col gap-3 px-1 pt-3 pb-0 sm:px-0">
          <div>
            <h3 className="font-serif text-lg font-semibold leading-tight">{auction.title}</h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {auction.seller.name ?? "Unknown artist"}
            </p>
          </div>

          <div className="mt-auto space-y-2 border-t border-border/70 pt-3">
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <span
                className={cn(
                  "flex items-center gap-1.5",
                  timeRemaining.isUrgent && !timeRemaining.isEnded && "text-rose-600",
                )}
              >
                <Clock className="size-3.5" />
                {timeRemaining.isEnded ? "Auction ended" : `${timeRemaining.label} remaining`}
              </span>
              <span className="flex items-center gap-1.5">
                <Gavel className="size-3.5" />
                {auction.bidCount} bids
              </span>
            </div>

            <div>
              <p className="text-muted-foreground text-[10px] uppercase tracking-[0.24em]">
                {timeRemaining.isEnded ? "Final Bid" : "Current Bid"}
              </p>
              <p className="font-serif text-xl font-bold">
                {currencyFormatter.format(auction.currentPriceCents / 100)}
              </p>
            </div>
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
