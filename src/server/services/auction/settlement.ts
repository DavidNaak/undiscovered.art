import { TRPCError } from "@trpc/server";
import { Prisma, type PrismaClient } from "../../../../generated/prisma";

import { isRetryableTransactionError } from "./retryable";

const MAX_SETTLEMENT_BATCH = 24;
const MAX_SETTLEMENT_TRANSACTION_RETRIES = 3;

export async function settleAuctionInTransaction(
  tx: Prisma.TransactionClient,
  auctionId: string,
  now: Date,
): Promise<void> {
  const auction = await tx.auction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      endsAt: true,
      settledAt: true,
    },
  });

  if (!auction || auction.settledAt) {
    return;
  }

  if (auction.status === "LIVE") {
    if (auction.endsAt > now) {
      return;
    }

    await tx.auction.updateMany({
      where: {
        id: auction.id,
        status: "LIVE",
        endsAt: { lte: now },
      },
      data: { status: "ENDED" },
    });
  } else if (auction.status !== "ENDED") {
    return;
  }

  const settlementClaimResult = await tx.auction.updateMany({
    where: {
      id: auction.id,
      status: "ENDED",
      settledAt: null,
    },
    data: {
      settledAt: now,
    },
  });

  if (settlementClaimResult.count !== 1) {
    return;
  }

  const winningBid = await tx.bid.findFirst({
    where: { auctionId: auction.id },
    orderBy: [{ amountCents: "desc" }, { createdAt: "desc" }],
    select: {
      bidderId: true,
      amountCents: true,
    },
  });

  if (!winningBid) {
    return;
  }

  const winnerDebitResult = await tx.user.updateMany({
    where: {
      id: winningBid.bidderId,
      reservedBalanceCents: { gte: winningBid.amountCents },
    },
    data: {
      reservedBalanceCents: { decrement: winningBid.amountCents },
    },
  });

  if (winnerDebitResult.count !== 1) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not settle winner balance",
    });
  }

  await tx.user.update({
    where: { id: auction.sellerId },
    data: {
      availableBalanceCents: { increment: winningBid.amountCents },
    },
  });
}

export async function settleAuctionById(
  db: PrismaClient,
  auctionId: string,
  now: Date,
): Promise<void> {
  for (
    let attempt = 1;
    attempt <= MAX_SETTLEMENT_TRANSACTION_RETRIES;
    attempt += 1
  ) {
    try {
      await db.$transaction(
        async (tx) => {
          await settleAuctionInTransaction(tx, auctionId, now);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
      return;
    } catch (error) {
      if (
        isRetryableTransactionError(error) &&
        attempt < MAX_SETTLEMENT_TRANSACTION_RETRIES
      ) {
        continue;
      }

      throw error;
    }
  }
}

export async function settleExpiredAuctions(
  db: PrismaClient,
  now: Date,
): Promise<void> {
  const expiredAuctions = await db.auction.findMany({
    where: {
      settledAt: null,
      endsAt: { lte: now },
      status: { in: ["LIVE", "ENDED"] },
    },
    select: { id: true },
    orderBy: { endsAt: "asc" },
    take: MAX_SETTLEMENT_BATCH,
  });

  for (const expiredAuction of expiredAuctions) {
    try {
      await settleAuctionById(db, expiredAuction.id, now);
    } catch (error) {
      console.error(
        `[AUCTION_SETTLEMENT] Failed to settle auction ${expiredAuction.id}`,
        error,
      );
    }
  }
}
