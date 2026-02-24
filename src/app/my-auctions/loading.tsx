import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyAuctionsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="space-y-2">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={`my-auctions-card-skeleton-${index}`} className="overflow-hidden">
            <div className="flex">
              <Skeleton className="h-28 w-28 shrink-0" />
              <CardContent className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-52" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </div>
            <CardContent className="flex items-center justify-between gap-2 border-t border-border/80 pt-3 text-xs">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
