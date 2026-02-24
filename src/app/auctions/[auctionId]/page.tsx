import { notFound } from "next/navigation";

import { SitePageShell } from "@/components/site-page-shell";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { settleExpiredAuctions } from "~/server/services/auction/settlement";

import { AuctionDetailView } from "./_components/auction-detail-view";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ auctionId: string }>;
}) {
  const { auctionId } = await params;
  const now = new Date();
  await settleExpiredAuctions(db, now);

  const session = await getSession();

  const auction = await db.auction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      dimensions: true,
      condition: true,
      artworkYear: true,
      imagePath: true,
      currentPriceCents: true,
      minIncrementCents: true,
      endsAt: true,
      status: true,
      bidCount: true,
      seller: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
      bids: {
        orderBy: [{ amountCents: "desc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          bidderId: true,
          amountCents: true,
          createdAt: true,
          bidder: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!auction) {
    notFound();
  }

  const bidHistory = auction.bids.map((bid) => ({
    id: bid.id,
    bidderId: bid.bidderId,
    amountCents: bid.amountCents,
    createdAt: bid.createdAt,
    bidderName: bid.bidder.name,
  }));

  return (
    <SitePageShell currentPath="/">
      <AuctionDetailView
        auction={{
          ...auction,
          status: auction.status,
        }}
        bidHistory={bidHistory}
        currentUserId={session?.user?.id ?? null}
      />
    </SitePageShell>
  );
}
