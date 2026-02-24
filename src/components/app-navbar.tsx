import Link from "next/link";
import { HandCoins, Menu, Search, Wallet } from "lucide-react";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function SearchForm({ defaultQuery }: { defaultQuery?: string }) {
  return (
    <form action="/" method="GET" className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
      <Input
        name="q"
        defaultValue={defaultQuery ?? ""}
        placeholder="Search auctions..."
        className="h-9 rounded-xl bg-white pl-9"
      />
    </form>
  );
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
  searchQuery,
}: {
  currentPath: string;
  searchQuery?: string;
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
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-zinc-50/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight sm:text-base">
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
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden min-w-0 flex-1 lg:block">
          <SearchForm defaultQuery={searchQuery} />
        </div>

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
              <Button
                variant="outline"
                render={<Link href="/login" />}
              >
                Sign In
              </Button>
              <Button
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

              <div className="mt-4">
                <SearchForm defaultQuery={searchQuery} />
              </div>

              {walletSummary ? (
                <div className="mt-4">
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
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900",
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
                    <Button render={<a href={GITHUB_SIGN_IN_HREF} />}>GitHub</Button>
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
