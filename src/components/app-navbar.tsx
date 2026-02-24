import Link from "next/link";
import { HandCoins, Menu, Wallet } from "lucide-react";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { UserMenu } from "./user-menu";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const GITHUB_SIGN_IN_HREF =
  "/api/auth/sign-in/social?provider=github&callbackURL=%2F";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/my-bids", label: "My Bids" },
  { href: "/about", label: "About" },
] as const;

function isActivePath(currentPath: string, href: string): boolean {
  if (href === "/") return currentPath === "/";
  return currentPath.startsWith(href);
}

function WalletSummary({
  availableCents,
  inBidsCents,
}: {
  availableCents: number;
  inBidsCents: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950 px-3 py-2 text-zinc-100">
      <div className="flex items-center gap-2" title="Available balance">
        <Wallet className="size-4 text-indigo-300" />
        <span className="text-sm font-medium">
          {usdFormatter.format(availableCents / 100)}
        </span>
      </div>
      <div className="h-6 w-px bg-zinc-700" />
      <div className="flex items-center gap-2" title="Currently in bids">
        <HandCoins className="size-4 text-emerald-300" />
        <span className="text-sm font-medium">
          {usdFormatter.format(inBidsCents / 100)}
        </span>
      </div>
    </div>
  );
}

export async function AppNavbar({
  currentPath,
}: {
  currentPath: string;
}) {
  const session = await getSession();
  const userId = session?.user?.id;

  const walletSummary = userId
    ? await (async () => {
        const userBalances = await db.user.findUnique({
          where: { id: userId },
          select: {
            availableBalanceCents: true,
            reservedBalanceCents: true,
          },
        });

        if (!userBalances) return null;

        return {
          availableCents: userBalances.availableBalanceCents,
          inBidsCents: userBalances.reservedBalanceCents,
        };
      })()
    : null;

  return (
    <header className="border-border/80 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-serif shrink-0 text-lg leading-none font-semibold tracking-tight">
          Undiscovered Art
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                isActivePath(currentPath, link.href)
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden min-w-0 flex-1 lg:block" />

        {walletSummary ? (
          <div className="hidden xl:block">
            <WalletSummary
              availableCents={walletSummary.availableCents}
              inBidsCents={walletSummary.inBidsCents}
            />
          </div>
        ) : null}

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {session ? (
            <UserMenu
              displayName={session.user.name || "Account"}
              email={session.user.email}
            />
          ) : (
            <>
              <Button variant="outline" className="rounded-full" render={<Link href="/login" />}>
                Sign In
              </Button>
              <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90" render={<a href={GITHUB_SIGN_IN_HREF} />}>
                GitHub
              </Button>
            </>
          )}
        </div>

        <div className="md:hidden">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" />}>
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="right" className="px-5 py-5">
              <SheetHeader className="p-0">
                <SheetTitle>Undiscovered Art</SheetTitle>
                <SheetDescription>
                  Browse auctions and manage your bids.
                </SheetDescription>
              </SheetHeader>

              {walletSummary ? (
                <div className="mt-6">
                  <WalletSummary
                    availableCents={walletSummary.availableCents}
                    inBidsCents={walletSummary.inBidsCents}
                  />
                </div>
              ) : null}

              <nav className="mt-6 flex flex-col gap-2">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActivePath(currentPath, link.href)
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-6 flex flex-col gap-2">
                {session ? (
                  <UserMenu
                    displayName={session.user.name || "Account"}
                    email={session.user.email}
                  />
                ) : (
                  <>
                    <Button variant="outline" render={<Link href="/login" />}>
                      Sign In
                    </Button>
                    <Button className="bg-foreground text-background hover:bg-foreground/90" render={<a href={GITHUB_SIGN_IN_HREF} />}>
                      GitHub
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
