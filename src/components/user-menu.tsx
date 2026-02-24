"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut, UserRound } from "lucide-react";

import { authClient } from "~/server/better-auth/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message ?? "Could not sign out");
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("[AUTH] Sign out failed", error);
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="h-9 gap-2 px-3" />}
      >
        <UserRound className="size-4" />
        <span className="hidden sm:inline">{displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-zinc-900">{displayName}</p>
          <p className="truncate text-xs font-normal text-zinc-500">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/" />}>Home</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/my-bids" />}>My Bids</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/about" />}>About</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
