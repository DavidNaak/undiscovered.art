import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyBidsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="space-y-2">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`my-bids-summary-skeleton-${index}`}>
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex items-center gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={`my-bids-filter-skeleton-${index}`} className="h-9 w-28 rounded-full" />
        ))}
      </section>

      <section className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={`my-bids-card-skeleton-${index}`} className="overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              <Skeleton className="h-44 w-full sm:h-auto sm:w-44" />
              <CardContent className="flex-1 space-y-4 p-4">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-7 w-56" />
                  <Skeleton className="h-4 w-44" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
