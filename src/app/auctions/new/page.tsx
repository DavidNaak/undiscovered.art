import Link from "next/link";
import { ArrowLeft, Clock3, ShieldCheck, Sparkles } from "lucide-react";

import { CreateAuctionForm } from "~/app/_components/create-auction-form";
import { getSession } from "~/server/better-auth/server";
import { SitePageShell } from "@/components/site-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const LAUNCH_NOTES = [
  "Pick a clear title and category so bidders can discover the piece quickly.",
  "Set a realistic opening price and minimum increment to encourage momentum.",
  "Use a close-up image with good lighting. This is the primary conversion driver.",
] as const;

export default async function NewAuctionPage() {
  const session = await getSession();
  const canCreate = Boolean(session?.user?.id);

  return (
    <SitePageShell currentPath="/auctions/new">
      <div className="space-y-6">
        <Button
          variant="outline"
          className="h-9 rounded-full"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <ArrowLeft className="size-4" />
          Back to auctions
        </Button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] lg:items-start">
          <Card className="overflow-hidden rounded-[28px] py-0">
            <div className="from-secondary/30 via-secondary/10 to-background border-b border-border/70 bg-gradient-to-b px-6 py-8">
              <Badge className="mb-3 rounded-full bg-foreground text-background hover:bg-foreground">
                Seller Studio
              </Badge>
              <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                Launch a New
                <span className="text-accent block">Art Auction</span>
              </h1>
              <p className="text-muted-foreground mt-4 max-w-md text-base leading-relaxed">
                Create a timed listing with verified pricing rules and automatic bidding safeguards.
              </p>
            </div>

            <CardContent className="space-y-5 px-6 py-6">
              <div className="space-y-3">
                {LAUNCH_NOTES.map((note) => (
                  <div key={note} className="flex items-start gap-3">
                    <Sparkles className="text-accent mt-0.5 size-4 shrink-0" />
                    <p className="text-muted-foreground text-sm leading-relaxed">{note}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-secondary/30 p-4">
                  <div className="mb-2 inline-flex rounded-full bg-background p-2">
                    <Clock3 className="text-muted-foreground size-4" />
                  </div>
                  <p className="text-sm font-medium">Timed close</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Auctions close automatically at your selected end time.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-secondary/30 p-4">
                  <div className="mb-2 inline-flex rounded-full bg-background p-2">
                    <ShieldCheck className="text-muted-foreground size-4" />
                  </div>
                  <p className="text-sm font-medium">Guaranteed payout</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Winning auctions settle automatically so your proceeds are credited without manual follow-up.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <CreateAuctionForm canCreate={canCreate} />
        </div>
      </div>
    </SitePageShell>
  );
}
