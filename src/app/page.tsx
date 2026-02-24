import { AuctionHouse } from "~/app/_components/auction-house";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";
import { SitePageShell } from "@/components/site-page-shell";

function normalizeSearchQuery(rawValue: string | string[] | undefined): string | undefined {
  if (!rawValue) return undefined;
  const value = Array.isArray(rawValue) ? rawValue[0] ?? "" : rawValue;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const searchQuery = normalizeSearchQuery(params.q);
  const session = await getSession();

  void api.auction.listOpen.prefetch(
    searchQuery ? { query: searchQuery } : undefined,
  );

  return (
    <HydrateClient>
      <SitePageShell currentPath="/" searchQuery={searchQuery}>
        <section className="mb-8 space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Undiscovered Art Auction House
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 sm:text-base">
            Launch timed auctions for your work, discover active pieces from other
            artists, and bid in real time.
          </p>
        </section>

        <AuctionHouse
          canCreate={Boolean(session)}
          currentUserId={session?.user?.id ?? null}
          searchQuery={searchQuery}
        />
      </SitePageShell>
    </HydrateClient>
  );
}
