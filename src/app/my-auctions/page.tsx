import Image from "next/image";
import Link from "next/link";

import { getAuctionCategoryLabel } from "~/lib/auctions/categories";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { getPublicImageUrl } from "~/server/storage/supabase";
import { SitePageShell } from "@/components/site-page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

function statusBadgeVariant(status: "LIVE" | "ENDED" | "CANCELLED") {
  if (status === "LIVE") return "secondary" as const;
  if (status === "ENDED") return "default" as const;
  return "destructive" as const;
}

export default async function MyAuctionsPage() {
  const session = await getSession();

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
      <section className="mb-6 space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">My Auctions</h1>
        <p className="text-sm text-zinc-600">
          Your listings, current prices, and auction status.
        </p>
      </section>

      {auctions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-zinc-600">
              You have not listed any auctions yet. Create one from the Home page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {auctions.map((auction) => {
            const imageUrl = getPublicImageUrl(auction.imagePath);

            return (
              <Card key={auction.id} className="overflow-hidden">
                <div className="flex">
                  <div className="relative h-28 w-28 shrink-0 bg-zinc-100">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={auction.title}
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
                      <p className="truncate text-sm font-semibold">{auction.title}</p>
                      <p className="line-clamp-1 text-xs text-zinc-500">
                        {auction.description ?? "No description"}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={statusBadgeVariant(auction.status)}>
                        {auction.status}
                      </Badge>
                      <Badge variant="outline">
                        {getAuctionCategoryLabel(auction.category)}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {auction.bidCount} {auction.bidCount === 1 ? "bid" : "bids"}
                      </span>
                    </div>
                  </div>
                </div>

                <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/80 pt-3 text-xs text-zinc-500">
                  <span>
                    Start {usdFormatter.format(auction.startPriceCents / 100)} /
                    Current {usdFormatter.format(auction.currentPriceCents / 100)}
                  </span>
                  <span>Ends {formatDate(auction.endsAt)}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </SitePageShell>
  );
}
