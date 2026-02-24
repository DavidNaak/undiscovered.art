import Link from "next/link";

import { SitePageShell } from "@/components/site-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuctionCategoryLabel } from "~/lib/auctions/categories";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { settleExpiredAuctions } from "~/server/services/auction/settlement";
import { getPublicImageUrl } from "~/server/storage/supabase";

import { MyBidsView } from "./_components/my-bids-view";

type BidStatus = "LEADING" | "OUTBID" | "WON" | "LOST" | "CANCELLED";

function computeBidStatus({
  auctionStatus,
  isCurrentLeader,
}: {
  auctionStatus: "LIVE" | "ENDED" | "CANCELLED";
  isCurrentLeader: boolean;
}): BidStatus {
  if (auctionStatus === "LIVE") {
    return isCurrentLeader ? "LEADING" : "OUTBID";
  }
  if (auctionStatus === "ENDED") {
    return isCurrentLeader ? "WON" : "LOST";
  }
  return "CANCELLED";
}

export default async function MyBidsPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    return (
      <SitePageShell currentPath="/my-bids">
        <Card>
          <CardHeader>
            <CardTitle>My Bids</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Sign in to track your bids and outcomes.
            </p>
            <Button nativeButton={false} render={<Link href="/login" />}>
              Sign in
            </Button>
          </CardContent>
        </Card>
      </SitePageShell>
    );
  }

  await settleExpiredAuctions(db, new Date());

  const rawBids = await db.bid.findMany({
    where: { bidderId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      auctionId: true,
      amountCents: true,
      createdAt: true,
      auction: {
        select: {
          id: true,
          title: true,
          category: true,
          imagePath: true,
          currentPriceCents: true,
          endsAt: true,
          status: true,
          bidCount: true,
          seller: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const bestBidByAuction = new Map<
    string,
    {
      auction: (typeof rawBids)[number]["auction"];
      amountCents: number;
      createdAt: Date;
    }
  >();

  for (const bid of rawBids) {
    const existing = bestBidByAuction.get(bid.auctionId);
    if (!existing) {
      bestBidByAuction.set(bid.auctionId, {
        auction: bid.auction,
        amountCents: bid.amountCents,
        createdAt: bid.createdAt,
      });
      continue;
    }

    const shouldReplace =
      bid.amountCents > existing.amountCents ||
      (bid.amountCents === existing.amountCents &&
        bid.createdAt.getTime() > existing.createdAt.getTime());

    if (shouldReplace) {
      bestBidByAuction.set(bid.auctionId, {
        auction: bid.auction,
        amountCents: bid.amountCents,
        createdAt: bid.createdAt,
      });
    }
  }

  const bidItems = [...bestBidByAuction.values()]
    .map((entry) => {
      const isCurrentLeader = entry.amountCents === entry.auction.currentPriceCents;
      const status = computeBidStatus({
        auctionStatus: entry.auction.status,
        isCurrentLeader,
      });

      return {
        auctionId: entry.auction.id,
        title: entry.auction.title,
        sellerId: entry.auction.seller.id,
        sellerName: entry.auction.seller.name ?? "Unknown artist",
        imageUrl: getPublicImageUrl(entry.auction.imagePath),
        categoryLabel: getAuctionCategoryLabel(entry.auction.category),
        yourBidCents: entry.amountCents,
        currentBidCents: entry.auction.currentPriceCents,
        endsAtIso: entry.auction.endsAt.toISOString(),
        totalBids: entry.auction.bidCount,
        status,
      };
    })
    .sort((a, b) => {
      const aIsActive = a.status === "LEADING" || a.status === "OUTBID";
      const bIsActive = b.status === "LEADING" || b.status === "OUTBID";

      if (aIsActive !== bIsActive) {
        return aIsActive ? -1 : 1;
      }
      return new Date(a.endsAtIso).getTime() - new Date(b.endsAtIso).getTime();
    });

  return (
    <SitePageShell currentPath="/my-bids">
      <MyBidsView bids={bidItems} />
    </SitePageShell>
  );
}
