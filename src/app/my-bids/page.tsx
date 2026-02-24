import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SitePageShell } from "@/components/site-page-shell";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { getPublicImageUrl } from "~/server/storage/supabase";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getBidState({
  auctionStatus,
  isCurrentLeader,
}: {
  auctionStatus: "LIVE" | "ENDED" | "CANCELLED";
  isCurrentLeader: boolean;
}) {
  if (auctionStatus === "LIVE") {
    return isCurrentLeader
      ? { label: "Leading", variant: "secondary" as const }
      : { label: "Outbid", variant: "outline" as const };
  }

  if (auctionStatus === "ENDED") {
    return isCurrentLeader
      ? { label: "Won", variant: "default" as const }
      : { label: "Lost", variant: "outline" as const };
  }

  return { label: "Cancelled", variant: "destructive" as const };
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
            <p className="text-sm text-zinc-600">
              Sign in to view your bidding history and active bids.
            </p>
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Sign in
            </Link>
          </CardContent>
        </Card>
      </SitePageShell>
    );
  }

  const bids = await db.bid.findMany({
    where: { bidderId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      amountCents: true,
      createdAt: true,
      auction: {
        select: {
          id: true,
          title: true,
          imagePath: true,
          currentPriceCents: true,
          endsAt: true,
          status: true,
          seller: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return (
    <SitePageShell currentPath="/my-bids">
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">My Bids</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Track your latest bids and see which auctions you&apos;re currently leading.
        </p>
      </section>

      {bids.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-zinc-600">
              You haven&apos;t placed any bids yet. Explore open auctions from the Home page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bids.map((bid) => {
            const isCurrentLeader =
              bid.amountCents === bid.auction.currentPriceCents;
            const bidState = getBidState({
              auctionStatus: bid.auction.status,
              isCurrentLeader,
            });
            const imageUrl = getPublicImageUrl(bid.auction.imagePath);

            return (
              <Card key={bid.id} className="overflow-hidden">
                <div className="flex">
                  <div className="relative h-28 w-28 shrink-0 bg-zinc-200">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={bid.auction.title}
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                    <div>
                      <p className="truncate text-sm font-semibold">{bid.auction.title}</p>
                      <p className="text-xs text-zinc-500">
                        by {bid.auction.seller.name ?? "Unknown artist"}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={bidState.variant}>{bidState.label}</Badge>
                      <span className="text-xs text-zinc-500">
                        Bid: {usdFormatter.format(bid.amountCents / 100)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Current: {usdFormatter.format(bid.auction.currentPriceCents / 100)}
                      </span>
                    </div>
                  </div>
                </div>
                <CardContent className="flex items-center justify-between border-t border-zinc-200/80 pt-3 text-xs text-zinc-500">
                  <span>Placed {formatDate(bid.createdAt)}</span>
                  <span>Ends {formatDate(bid.auction.endsAt)}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </SitePageShell>
  );
}
