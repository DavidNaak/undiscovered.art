"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type AuctionStatus = "LIVE" | "ENDED" | "CANCELLED";

type MyAuctionItem = {
  id: string;
  title: string;
  description: string | null;
  categoryLabel: string;
  imageUrl: string | null;
  status: AuctionStatus;
  startPriceCents: number;
  currentPriceCents: number;
  bidCount: number;
  endsAtLabel: string;
};

function statusBadgeClass(status: AuctionStatus): string {
  if (status === "LIVE") {
    return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  }
  if (status === "ENDED") {
    return "bg-zinc-900 text-white hover:bg-zinc-900";
  }
  return "bg-red-100 text-red-700 hover:bg-red-100";
}

export function MyAuctionsView({
  auctions,
}: {
  auctions: MyAuctionItem[];
}) {
  const router = useRouter();
  const hasLiveAuctions = useMemo(
    () => auctions.some((auction) => auction.status === "LIVE"),
    [auctions],
  );

  useEffect(() => {
    if (!hasLiveAuctions) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [hasLiveAuctions, router]);

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">My Auctions</h1>
          <p className="text-sm text-zinc-600">
            Your listings, current prices, and auction status.
          </p>
        </div>

        <Button
          className="h-10 w-fit rounded-full bg-foreground px-5 text-sm text-background hover:bg-foreground/90"
          nativeButton={false}
          render={<Link href="/auctions/new" />}
        >
          <Plus className="size-4" />
          Create Auction
        </Button>
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
          {auctions.map((auction) => (
            <Link
              key={auction.id}
              href={`/auctions/${auction.id}`}
              className="group block cursor-pointer"
            >
              <Card className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex">
                  <div className="relative h-28 w-28 shrink-0 bg-zinc-100">
                    {auction.imageUrl ? (
                      <Image
                        src={auction.imageUrl}
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
                      <p className="truncate text-sm font-semibold group-hover:underline">
                        {auction.title}
                      </p>
                      <p className="line-clamp-1 text-xs text-zinc-500">
                        {auction.description ?? "No description"}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className={statusBadgeClass(auction.status)}>
                        {auction.status}
                      </Badge>
                      <Badge variant="outline">{auction.categoryLabel}</Badge>
                      <span className="text-xs text-zinc-500">
                        {auction.bidCount} {auction.bidCount === 1 ? "bid" : "bids"}
                      </span>
                    </div>
                  </div>
                </div>

                <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/80 pt-3 text-xs text-zinc-500">
                  <span>
                    Start {usdFormatter.format(auction.startPriceCents / 100)} / Current{" "}
                    {usdFormatter.format(auction.currentPriceCents / 100)}
                  </span>
                  <span>Ends {auction.endsAtLabel}</span>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
