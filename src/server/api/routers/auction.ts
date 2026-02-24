import { TRPCError } from "@trpc/server";
import { Prisma } from "../../../../generated/prisma";

import { createAuctionSchema, placeBidSchema } from "~/lib/auctions/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import {
  getPublicImageUrl,
  getStorageBucket,
  getSupabaseAdminClient,
} from "~/server/storage/supabase";

const MAX_BID_TRANSACTION_RETRIES = 3;

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export const auctionRouter = createTRPCRouter({
  listOpen: publicProcedure.query(async ({ ctx }) => {
    const auctions = await ctx.db.auction.findMany({
      where: {
        status: "LIVE",
        endsAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        imagePath: true,
        startPriceCents: true,
        currentPriceCents: true,
        minIncrementCents: true,
        endsAt: true,
        createdAt: true,
        seller: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      take: 24,
    });

    return auctions.map((auction) => ({
      ...auction,
      imageUrl: getPublicImageUrl(auction.imagePath),
    }));
  }),

  create: protectedProcedure
    .input(createAuctionSchema)
    .mutation(async ({ ctx, input }) => {
      const imagePathPrefix = `${ctx.session.user.id}/`;
      if (!input.imagePath.startsWith(imagePathPrefix)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid artwork image path",
        });
      }

      try {
        const auction = await ctx.db.auction.create({
          data: {
            sellerId: ctx.session.user.id,
            title: input.title.trim(),
            description: input.description?.trim() ?? null,
            imagePath: input.imagePath,
            startPriceCents: input.startPriceCents,
            currentPriceCents: input.startPriceCents,
            minIncrementCents: input.minIncrementCents,
            endsAt: input.endsAt,
          },
          select: {
            id: true,
            title: true,
            endsAt: true,
            imagePath: true,
            startPriceCents: true,
            currentPriceCents: true,
          },
        });

        return {
          ...auction,
          imageUrl: getPublicImageUrl(auction.imagePath),
        };
      } catch (error) {
        try {
          const { error: cleanupError } = await getSupabaseAdminClient()
            .storage
            .from(getStorageBucket())
            .remove([input.imagePath]);

          if (cleanupError) {
            console.error(
              `[AUCTION_CREATE] Failed to clean up uploaded image ${input.imagePath}: ${cleanupError.message}`,
            );
          }
        } catch (cleanupError) {
          console.error(
            `[AUCTION_CREATE] Failed to run image cleanup for ${input.imagePath}`,
            cleanupError,
          );
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create auction. Please try again.",
          cause: error,
        });
      }
    }),

  placeBid: protectedProcedure
    .input(placeBidSchema)
    .mutation(async ({ ctx, input }) => {
      for (let attempt = 1; attempt <= MAX_BID_TRANSACTION_RETRIES; attempt += 1) {
        try {
          const transactionResult = await ctx.db.$transaction(
            async (tx) => {
              const now = new Date();
              const auction = await tx.auction.findUnique({
                where: { id: input.auctionId },
                select: {
                  id: true,
                  sellerId: true,
                  status: true,
                  endsAt: true,
                  currentPriceCents: true,
                  minIncrementCents: true,
                  bidCount: true,
                },
              });

              if (!auction) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Auction not found",
                });
              }

              if (auction.sellerId === ctx.session.user.id) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "You cannot bid on your own auction",
                });
              }

              if (auction.status !== "LIVE" || auction.endsAt <= now) {
                if (auction.status === "LIVE" && auction.endsAt <= now) {
                  await tx.auction.updateMany({
                    where: {
                      id: auction.id,
                      status: "LIVE",
                      endsAt: { lte: now },
                    },
                    data: { status: "ENDED" },
                  });
                }

                return { kind: "closed" as const };
              }

              const minimumNextBidCents =
                auction.currentPriceCents + auction.minIncrementCents;

              if (input.amountCents < minimumNextBidCents) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Bid must be at least ${minimumNextBidCents} cents`,
                });
              }

              const currentLeadingBid = await tx.bid.findFirst({
                where: { auctionId: auction.id },
                orderBy: [{ amountCents: "desc" }, { createdAt: "desc" }],
                select: {
                  bidderId: true,
                  amountCents: true,
                },
              });

              const requiredAdditionalHoldCents =
                currentLeadingBid?.bidderId === ctx.session.user.id
                  ? input.amountCents - currentLeadingBid.amountCents
                  : input.amountCents;

              if (requiredAdditionalHoldCents > 0) {
                const reserveResult = await tx.user.updateMany({
                  where: {
                    id: ctx.session.user.id,
                    availableBalanceCents: { gte: requiredAdditionalHoldCents },
                  },
                  data: {
                    availableBalanceCents: { decrement: requiredAdditionalHoldCents },
                    reservedBalanceCents: { increment: requiredAdditionalHoldCents },
                  },
                });

                if (reserveResult.count !== 1) {
                  throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Insufficient available balance",
                  });
                }
              }

              const updateResult = await tx.auction.updateMany({
                where: {
                  id: auction.id,
                  status: "LIVE",
                  endsAt: { gt: now },
                  currentPriceCents: auction.currentPriceCents,
                },
                data: {
                  currentPriceCents: input.amountCents,
                  bidCount: { increment: 1 },
                },
              });

              if (updateResult.count !== 1) {
                throw new TRPCError({
                  code: "CONFLICT",
                  message: "Auction price changed. Refresh and try again.",
                });
              }

              if (
                currentLeadingBid &&
                currentLeadingBid.bidderId !== ctx.session.user.id
              ) {
                const releaseResult = await tx.user.updateMany({
                  where: {
                    id: currentLeadingBid.bidderId,
                    reservedBalanceCents: { gte: currentLeadingBid.amountCents },
                  },
                  data: {
                    availableBalanceCents: { increment: currentLeadingBid.amountCents },
                    reservedBalanceCents: { decrement: currentLeadingBid.amountCents },
                  },
                });

                if (releaseResult.count !== 1) {
                  throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Could not release previous leading bid hold",
                  });
                }
              }

              const bid = await tx.bid.create({
                data: {
                  auctionId: auction.id,
                  bidderId: ctx.session.user.id,
                  amountCents: input.amountCents,
                },
                select: {
                  id: true,
                  auctionId: true,
                  bidderId: true,
                  amountCents: true,
                  createdAt: true,
                },
              });

              return {
                kind: "placed" as const,
                bid: {
                  ...bid,
                  currentPriceCents: input.amountCents,
                  bidCount: auction.bidCount + 1,
                  minimumNextBidCents: input.amountCents + auction.minIncrementCents,
                },
              };
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );

          if (transactionResult.kind === "closed") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Auction is closed",
            });
          }

          return transactionResult.bid;
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }

          if (
            isRetryableTransactionError(error) &&
            attempt < MAX_BID_TRANSACTION_RETRIES
          ) {
            continue;
          }

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not place bid. Please try again.",
            cause: error,
          });
        }
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not place bid. Please try again.",
      });
    }),
});
