import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuctionCategoryLabel } from "~/lib/auctions/categories";
import { getPublicImageUrl } from "~/server/storage/supabase";
import { SitePageShell } from "@/components/site-page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "~/server/db";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function initialsFromName(name: string | null): string {
  if (!name) return "U";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      image: true,
      createdAt: true,
      sellerAuctions: {
        orderBy: [{ createdAt: "desc" }],
        take: 24,
        select: {
          id: true,
          title: true,
          category: true,
          imagePath: true,
          status: true,
          currentPriceCents: true,
          bidCount: true,
          endsAt: true,
        },
      },
      _count: {
        select: {
          sellerAuctions: true,
          bids: true,
        },
      },
    },
  });

  if (!user) {
    notFound();
  }

  const liveCount = user.sellerAuctions.filter((auction) => auction.status === "LIVE").length;

  return (
    <SitePageShell currentPath="/">
      <div className="space-y-8">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "Profile image"}
                  width={56}
                  height={56}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="bg-secondary flex size-14 items-center justify-center rounded-full text-sm font-semibold">
                  {initialsFromName(user.name)}
                </div>
              )}
              <div>
                <h1 className="font-serif text-3xl font-semibold text-balance">
                  {user.name ?? "Anonymous Artist"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  Public profile · Joined {formatDate(user.createdAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[300px]">
              <Card>
                <CardContent className="px-3 py-2">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Listings</p>
                  <p className="font-serif text-lg font-semibold">{user._count.sellerAuctions}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="px-3 py-2">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Live</p>
                  <p className="font-serif text-lg font-semibold">{liveCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="px-3 py-2">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-wide">Bids</p>
                  <p className="font-serif text-lg font-semibold">{user._count.bids}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Auctions by {user.name ?? "this user"}</h2>
          {user.sellerAuctions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No auctions listed yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {user.sellerAuctions.map((auction) => {
                const imageUrl = getPublicImageUrl(auction.imagePath) ?? "/auction-placeholder.svg";
                return (
                  <Link key={auction.id} href={`/auctions/${auction.id}`}>
                    <Card className="group overflow-hidden border-border/90 pt-0 transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="relative aspect-[4/3] bg-secondary">
                        <Image
                          src={imageUrl}
                          alt={auction.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      </div>
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{getAuctionCategoryLabel(auction.category)}</Badge>
                          <Badge variant="outline">{auction.status}</Badge>
                        </div>
                        <p className="font-serif text-lg font-semibold leading-tight">{auction.title}</p>
                        <p className="text-muted-foreground text-sm">
                          {currencyFormatter.format(auction.currentPriceCents / 100)} · {auction.bidCount} bids
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Ends {formatDate(auction.endsAt)}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </SitePageShell>
  );
}
