import { AuctionHouse } from "~/app/_components/auction-house";
import { SitePageShell } from "@/components/site-page-shell";

export default function Home() {
  return (
    <SitePageShell currentPath="/">
      <AuctionHouse />
    </SitePageShell>
  );
}
