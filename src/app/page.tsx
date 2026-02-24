import { AuctionHouse } from "~/app/_components/auction-house";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";
import { SitePageShell } from "@/components/site-page-shell";

export default async function Home() {
  const session = await getSession();

  void api.auction.listOpen.prefetch();

  return (
    <HydrateClient>
      <SitePageShell currentPath="/">
        <AuctionHouse
          canCreate={Boolean(session)}
          currentUserId={session?.user?.id ?? null}
        />
      </SitePageShell>
    </HydrateClient>
  );
}
