import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Eye,
  Globe,
  Heart,
  Palette,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { AppNavbar } from "@/components/app-navbar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const VALUES = [
  {
    icon: Eye,
    title: "Radical Transparency",
    description:
      "Every bid is public. Every auction timeline is real. There are no hidden reserves, no backroom deals. You see exactly what everyone sees.",
  },
  {
    icon: Shield,
    title: "Artist-First Economics",
    description:
      "Artists keep the lion's share. No gallery commissions eating 50% of earnings. We charge a flat platform fee so creators actually benefit from their work.",
  },
  {
    icon: Sparkles,
    title: "Curation Without Gatekeeping",
    description:
      "We don't decide what's art and what isn't. If you create it and believe in it, you can auction it. The market -- real people, real bids -- decides the value.",
  },
  {
    icon: Users,
    title: "Community Over Competition",
    description:
      "Bidders aren't just wallets to us. They're collectors building meaningful relationships with artists whose careers they help launch.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create Your Auction",
    description:
      "Upload your artwork, write your story, set a starting price and duration. It takes less than two minutes.",
  },
  {
    step: "02",
    title: "Collectors Discover & Bid",
    description:
      "Your piece goes live immediately. Collectors browse by category, search by style, and place timed bids in real time.",
  },
  {
    step: "03",
    title: "The Market Decides",
    description:
      "When the clock runs out, the highest bidder wins. The artist gets paid. A new relationship between creator and collector begins.",
  },
] as const;

const STATS = [
  { value: "2,400+", label: "Artists on the platform" },
  { value: "$3.2M", label: "Paid to artists" },
  { value: "18,000+", label: "Auctions completed" },
  { value: "47", label: "Countries represented" },
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNavbar currentPath="/about" />

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex flex-col gap-8 py-16 lg:flex-row lg:items-center lg:gap-16 lg:py-24">
              <div className="flex flex-1 flex-col gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-px max-w-12 flex-1 bg-accent" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                    Our Story
                  </span>
                </div>
                <h1 className="font-serif text-balance text-4xl leading-[1.1] font-bold lg:text-6xl">
                  Art should be
                  <br />
                  <span className="text-accent">discovered,</span>
                  <br />
                  not gatekept.
                </h1>
                <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                  Undiscovered Art is a timed auction platform built for emerging artists
                  and the collectors who want to find them before anyone else does. No
                  galleries. No middlemen. Just artists, collectors, and real-time
                  bidding.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    className="rounded-full bg-foreground px-6 text-background hover:bg-foreground/90"
                    nativeButton={false}
                    render={<Link href="/" />}
                  >
                    Browse Auctions
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 rounded-full px-6"
                    nativeButton={false}
                    render={<Link href="/my-auctions" />}
                  >
                    <Palette className="size-4" />
                    Start Selling
                  </Button>
                </div>
              </div>

              <div className="relative flex-1 lg:max-w-[50%]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-secondary">
                  <Image
                    src="/images/about-hero.jpg"
                    alt="A warm, sunlit art gallery with contemporary works on white walls"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                </div>
                <div className="absolute -bottom-4 -left-4 rounded-lg border border-border bg-card p-4 shadow-lg lg:-bottom-6 lg:-left-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-accent/15">
                      <Globe className="size-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">47 countries</p>
                      <p className="text-xs text-muted-foreground">Artists represented globally</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 px-4 py-8">
                <p className="font-serif text-3xl font-bold text-foreground lg:text-4xl">
                  {stat.value}
                </p>
                <p className="text-center text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              The Problem
            </span>
            <h2 className="font-serif text-balance mt-4 text-3xl font-bold text-foreground lg:text-4xl">
              The traditional art market is broken for emerging artists
            </h2>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground">
              Gallery representation takes years. Commission structures eat into
              earnings. Visibility is reserved for the already-established. Meanwhile,
              incredible work goes unseen, undervalued, and unsold. Undiscovered Art
              was built to change that -- to create a direct line between artists who
              deserve to be seen and collectors who want to find something real before
              the rest of the world catches on.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <Separator />
        </div>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="mb-12">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              How It Works
            </span>
            <h2 className="font-serif text-balance mt-4 text-3xl font-bold text-foreground lg:text-4xl">
              Three steps. No complexity.
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="group flex flex-col gap-4">
                <span className="font-serif text-5xl font-bold text-accent/20 transition-colors group-hover:text-accent/40">
                  {item.step}
                </span>
                <h3 className="font-serif text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <Separator />
        </div>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="mb-12">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              What We Believe
            </span>
            <h2 className="font-serif text-balance mt-4 text-3xl font-bold text-foreground lg:text-4xl">
              Principles, not just features
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className="group flex -translate-y-0 flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-accent/10 transition-colors group-hover:bg-accent/20">
                    <Icon className="size-5 text-accent" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-foreground">
                    {value.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <Separator />
        </div>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-8">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
                <Palette className="size-5 text-accent" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-foreground">For Artists</h3>
              <ul className="flex flex-col gap-3">
                {[
                  "Set your own starting price and auction duration",
                  "Keep the majority of every sale -- flat, transparent fees",
                  "Build a collector base that follows your career",
                  "No approval process -- list your first auction in minutes",
                  "Real-time bidding creates urgency and fair market pricing",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <div className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-auto rounded-full bg-foreground text-background hover:bg-foreground/90"
                nativeButton={false}
                render={<Link href="/my-auctions" />}
              >
                Start Selling
                <ArrowRight className="size-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-8">
              <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
                <Heart className="size-5 text-accent" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-foreground">For Collectors</h3>
              <ul className="flex flex-col gap-3">
                {[
                  "Discover original work from artists across 47 countries",
                  "Transparent bidding -- see every bid as it happens",
                  "No buyer's premium or hidden auction fees",
                  "Build relationships directly with the artists you support",
                  "Track all your bids and wins from a single dashboard",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <div className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="mt-auto gap-2 rounded-full"
                nativeButton={false}
                render={<Link href="/" />}
              >
                Browse Auctions
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-foreground">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-16 text-center lg:px-8 lg:py-24">
            <div className="flex items-center gap-3">
              <Clock className="size-5 text-accent" />
              <span className="text-sm font-medium text-background/70">
                New auctions go live every day
              </span>
            </div>
            <h2 className="max-w-2xl font-serif text-3xl font-bold text-balance text-background lg:text-5xl">
              The next great artist is waiting to be discovered. Maybe by you.
            </h2>
            <p className="max-w-lg text-base text-background/60">
              Whether you create art or collect it, Undiscovered Art gives you a fair,
              transparent, and genuinely exciting way to participate in the art market.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                className="rounded-full bg-accent px-6 text-foreground hover:bg-accent/90"
                nativeButton={false}
                render={<Link href="/" />}
              >
                Explore Auctions
                <ArrowRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-background/20 bg-transparent px-6 text-background hover:bg-background/10 hover:text-background"
                nativeButton={false}
                render={<Link href="/my-auctions" />}
              >
                <Palette className="size-4" />
                Create Your First Auction
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-secondary/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row lg:px-8">
          <span className="font-serif font-semibold text-foreground">Undiscovered Art</span>
          <p>Auction platform for emerging and established artists.</p>
        </div>
      </footer>
    </div>
  );
}
