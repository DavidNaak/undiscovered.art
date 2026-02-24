import { SitePageShell } from "@/components/site-page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <SitePageShell currentPath="/about">
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Undiscovered Art is a timed auction marketplace for digital and physical
          artwork. Artists can list pieces, buyers place competing bids, and the
          highest valid bid wins when the auction closes.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>How Bidding Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-600">
            <p>1. Every auction has a start price, minimum increment, and end time.</p>
            <p>2. Bids are validated server-side before they are accepted.</p>
            <p>3. Funds are reserved while you lead an auction, then released if outbid.</p>
            <p>4. On auction end, the winner pays and the seller receives the amount.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reliability Guarantees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-600">
            <p>
              Concurrent bids are protected with serializable transactions and
              conflict retries.
            </p>
            <p>
              Auction state is settled on read and on bid placement, so expired auctions
              do not keep accepting bids.
            </p>
            <p>
              Live auction data refreshes every 2 seconds on the client for a simple,
              production-friendly real-time experience.
            </p>
          </CardContent>
        </Card>
      </div>
    </SitePageShell>
  );
}
