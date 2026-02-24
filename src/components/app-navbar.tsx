import Link from "next/link";
import { BriefcaseBusiness, HandCoins, Menu } from "lucide-react";

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
  { href: "/my-auctions", label: "My Auctions" },
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
    <div className="flex items-center gap-3 rounded-full border border-zinc-300/90 bg-white px-3.5 py-2 text-zinc-900 shadow-sm">
      <div className="flex items-center gap-2" title="Available balance">
        <BriefcaseBusiness className="size-4 text-zinc-600" />
        <span className="text-sm font-semibold tracking-tight">
          {usdFormatter.format(availableCents / 100)}
        </span>
      </div>
      <div className="h-5 w-px bg-zinc-300" />
      <div className="flex items-center gap-2" title="Currently reserved in bids">
        <HandCoins className="size-4 text-emerald-600" />
        <span className="text-sm font-semibold tracking-tight">
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
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[68px] lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-serif shrink-0 text-[20px] leading-none font-semibold tracking-tight"
          >
            Undiscovered Art
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  isActivePath(currentPath, link.href)
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {walletSummary ? (
            <WalletSummary
              availableCents={walletSummary.availableCents}
              inBidsCents={walletSummary.inBidsCents}
            />
          ) : null}

          {session ? (
            <UserMenu
              displayName={session.user.name || "Account"}
              email={session.user.email}
            />
          ) : (
            <>
              <Button
                variant="outline"
                className="h-10 rounded-full px-4"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                Sign In
              </Button>
              <Button
                className="h-10 rounded-full bg-foreground px-4 text-background hover:bg-foreground/90"
                nativeButton={false}
                render={<a href={GITHUB_SIGN_IN_HREF} />}
              >
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
                    <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
                      Sign In
                    </Button>
                    <Button
                      className="bg-foreground text-background hover:bg-foreground/90"
                      nativeButton={false}
                      render={<a href={GITHUB_SIGN_IN_HREF} />}
                    >
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
