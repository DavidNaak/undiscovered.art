"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AuctionCardSkeleton() {
  return (
    <Card className="overflow-hidden bg-transparent pt-0 shadow-none ring-0">
      <div className="aspect-[4/5] w-full">
        <Skeleton className="h-full w-full rounded-md" />
      </div>
      <CardContent className="space-y-4 px-1 pt-3 pb-0 sm:px-0">
        <div className="space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        <div className="flex items-end justify-between gap-2 border-t border-border pt-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-36" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
