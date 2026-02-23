import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuctionHouse } from "~/app/_components/auction-house";
import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";
import { api, HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await getSession();
  void api.auction.listOpen.prefetch();

  return (
    <HydrateClient>
      <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-zinc-100 to-amber-50/80 p-6 text-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-8">
          <header className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Undiscovered Art Auction House
            </h1>
            <p className="max-w-2xl text-sm text-zinc-600 sm:text-base">
              Launch a timed auction for your artwork and browse active pieces
              from other creators.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {session ? (
                <>
                  <p className="text-sm text-zinc-600">
                    Signed in as{" "}
                    <span className="font-medium text-zinc-900">
                      {session.user?.name || session.user?.email}
                    </span>
                  </p>
                  <form>
                    <button
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium transition hover:bg-zinc-100"
                      formAction={async () => {
                        "use server";
                        await auth.api.signOut({
                          headers: await headers(),
                        });
                        redirect("/");
                      }}
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <form>
                  <button
                    className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
                    formAction={async () => {
                      "use server";
                      const res = await auth.api.signInSocial({
                        body: {
                          provider: "github",
                          callbackURL: "/",
                        },
                      });
                      if (!res.url) {
                        throw new Error("No URL returned from signInSocial");
                      }
                      redirect(res.url);
                    }}
                  >
                    Sign in with GitHub
                  </button>
                </form>
              )}
            </div>
          </header>

          <AuctionHouse canCreate={Boolean(session)} />
        </div>
      </main>
    </HydrateClient>
  );
}
