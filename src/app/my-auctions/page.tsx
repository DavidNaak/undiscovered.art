import Link from "next/link";

import { getAuctionCategoryLabel } from "~/lib/auctions/categories";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { getPublicImageUrl } from "~/server/storage/supabase";
import { SitePageShell } from "@/components/site-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MyAuctionsView } from "./_components/my-auctions-view";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type AuctionStatus = "LIVE" | "ENDED" | "CANCELLED";

function resolveDisplayStatus(status: AuctionStatus, endsAt: Date, now: Date): AuctionStatus {
  if (status === "LIVE" && endsAt <= now) {
    return "ENDED";
  }
  return status;
}

export default async function MyAuctionsPage() {
  const session = await getSession();
  const now = new Date();

  if (!session?.user?.id) {
    return (
      <SitePageShell currentPath="/my-auctions">
        <Card>
          <CardHeader>
            <CardTitle>My Auctions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-zinc-600">
              Sign in to view and manage your listings.
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

  const auctions = await db.auction.findMany({
    where: { sellerId: session.user.id },
    orderBy: [{ createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      imagePath: true,
      status: true,
      startPriceCents: true,
      currentPriceCents: true,
      bidCount: true,
      endsAt: true,
      createdAt: true,
    },
  });

  return (
    <SitePageShell currentPath="/my-auctions">
      <MyAuctionsView
        auctions={auctions.map((auction) => {
          const displayStatus = resolveDisplayStatus(auction.status, auction.endsAt, now);

          return {
            id: auction.id,
            title: auction.title,
            description: auction.description,
            categoryLabel: getAuctionCategoryLabel(auction.category),
            imageUrl: getPublicImageUrl(auction.imagePath),
            status: displayStatus,
            startPriceCents: auction.startPriceCents,
            currentPriceCents: auction.currentPriceCents,
            bidCount: auction.bidCount,
            endsAtLabel: formatDate(auction.endsAt),
          };
        })}
      />
    </SitePageShell>
  );
}
