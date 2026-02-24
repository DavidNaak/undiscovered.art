import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "../../../../generated/prisma";

import { type PlaceBidInput } from "~/lib/auctions/schema";

import { isRetryableTransactionError } from "./retryable";
import { settleAuctionInTransaction } from "./settlement";

const MAX_BID_TRANSACTION_RETRIES = 3;

type PlaceBidResult = {
  id: string;
  auctionId: string;
  bidderId: string;
  amountCents: number;
  createdAt: Date;
  currentPriceCents: number;
  bidCount: number;
  minimumNextBidCents: number;
};

export async function placeBid({
  db,
  input,
  userId,
}: {
  db: PrismaClient;
  input: PlaceBidInput;
  userId: string;
}): Promise<PlaceBidResult> {
  for (let attempt = 1; attempt <= MAX_BID_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const transactionResult = await db.$transaction(
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

          if (auction.sellerId === userId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You cannot bid on your own auction",
            });
          }

          if (auction.status !== "LIVE" || auction.endsAt <= now) {
            await settleAuctionInTransaction(tx, auction.id, now);
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
            currentLeadingBid?.bidderId === userId
              ? input.amountCents - currentLeadingBid.amountCents
              : input.amountCents;

          if (requiredAdditionalHoldCents > 0) {
            const reserveResult = await tx.user.updateMany({
              where: {
                id: userId,
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

          if (currentLeadingBid && currentLeadingBid.bidderId !== userId) {
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
              bidderId: userId,
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
}
