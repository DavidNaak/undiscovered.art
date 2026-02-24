#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { Prisma, PrismaClient } from "../generated/prisma/index.js";

function stripInlineComment(rawValue) {
  let value = "";
  let activeQuote = null;
  let isEscaped = false;

  for (const char of rawValue) {
    if (isEscaped) {
      value += char;
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      value += char;
      isEscaped = true;
      continue;
    }

    if ((char === '"' || char === "'") && activeQuote === null) {
      activeQuote = char;
      value += char;
      continue;
    }

    if (char === activeQuote) {
      activeQuote = null;
      value += char;
      continue;
    }

    if (char === "#" && activeQuote === null) {
      break;
    }

    value += char;
  }

  return value.trim();
}

function parseEnvValue(rawValue) {
  const valueWithoutComment = stripInlineComment(rawValue);

  if (
    (valueWithoutComment.startsWith('"') && valueWithoutComment.endsWith('"')) ||
    (valueWithoutComment.startsWith("'") && valueWithoutComment.endsWith("'"))
  ) {
    return valueWithoutComment.slice(1, -1).replaceAll("\\n", "\n");
  }

  return valueWithoutComment;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) continue;

    const match = trimmedLine.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = parseEnvValue(rawValue);
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add it to .env before running this test.");
  process.exit(1);
}

const MAX_BID_TRANSACTION_RETRIES = 3;
const runTag = `concurrency-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

const db = new PrismaClient();

class BidError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BidError";
    this.code = code;
  }
}

function isRetryableTransactionError(error) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
  );
}

async function placeBidWithTransaction({ auctionId, bidderId, amountCents }) {
  for (let attempt = 1; attempt <= MAX_BID_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const transactionResult = await db.$transaction(
        async (tx) => {
          const now = new Date();

          const auction = await tx.auction.findUnique({
            where: { id: auctionId },
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
            throw new BidError("NOT_FOUND", "Auction not found");
          }

          if (auction.sellerId === bidderId) {
            throw new BidError("FORBIDDEN", "You cannot bid on your own auction");
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

            return { kind: "closed" };
          }

          const minimumNextBidCents =
            auction.currentPriceCents + auction.minIncrementCents;

          if (amountCents < minimumNextBidCents) {
            throw new BidError(
              "BAD_REQUEST",
              `Bid must be at least ${minimumNextBidCents} cents`,
            );
          }

          const updateResult = await tx.auction.updateMany({
            where: {
              id: auction.id,
              status: "LIVE",
              endsAt: { gt: now },
              currentPriceCents: auction.currentPriceCents,
            },
            data: {
              currentPriceCents: amountCents,
              bidCount: { increment: 1 },
            },
          });

          if (updateResult.count !== 1) {
            throw new BidError(
              "CONFLICT",
              "Auction price changed. Refresh and try again.",
            );
          }

          const bid = await tx.bid.create({
            data: {
              auctionId: auction.id,
              bidderId,
              amountCents,
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
            kind: "placed",
            bid,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (transactionResult.kind === "closed") {
        throw new BidError("BAD_REQUEST", "Auction is closed");
      }

      return transactionResult.bid;
    } catch (error) {
      if (error instanceof BidError) {
        throw error;
      }

      if (
        isRetryableTransactionError(error) &&
        attempt < MAX_BID_TRANSACTION_RETRIES
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new BidError("INTERNAL_SERVER_ERROR", "Could not place bid");
}

const createdUserIds = new Set();
const createdAuctionIds = new Set();

function randomId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function createUser(label) {
  const id = randomId(`test-user-${label}`);
  createdUserIds.add(id);

  return db.user.create({
    data: {
      id,
      name: `${label}-${runTag}`,
      email: `${id}@example.test`,
      emailVerified: true,
    },
    select: { id: true, name: true, email: true },
  });
}

async function createAuction({ sellerId, startPriceCents, minIncrementCents, endsAt }) {
  const auction = await db.auction.create({
    data: {
      sellerId,
      title: `Test Auction ${runTag}`,
      description: "Concurrency integration test auction",
      imagePath: `${sellerId}/test-${runTag}.jpg`,
      startPriceCents,
      currentPriceCents: startPriceCents,
      minIncrementCents,
      endsAt,
    },
    select: {
      id: true,
      currentPriceCents: true,
      minIncrementCents: true,
      bidCount: true,
      status: true,
      endsAt: true,
    },
  });

  createdAuctionIds.add(auction.id);
  return auction;
}

async function runTest(name, testFn) {
  process.stdout.write(`- ${name}... `);
  await testFn();
  console.log("ok");
}

async function cleanupTestData() {
  const auctionIds = Array.from(createdAuctionIds);
  const userIds = Array.from(createdUserIds);

  if (auctionIds.length > 0) {
    await db.bid.deleteMany({ where: { auctionId: { in: auctionIds } } });
    await db.auction.deleteMany({ where: { id: { in: auctionIds } } });
  }

  if (userIds.length > 0) {
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function testSameAmountRace() {
  const seller = await createUser("seller-race");
  const bidderA = await createUser("bidder-race-a");
  const bidderB = await createUser("bidder-race-b");

  const auction = await createAuction({
    sellerId: seller.id,
    startPriceCents: 10_000,
    minIncrementCents: 100,
    endsAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  const targetBidCents = 10_100;
  const results = await Promise.allSettled([
    placeBidWithTransaction({
      auctionId: auction.id,
      bidderId: bidderA.id,
      amountCents: targetBidCents,
    }),
    placeBidWithTransaction({
      auctionId: auction.id,
      bidderId: bidderB.id,
      amountCents: targetBidCents,
    }),
  ]);

  const successes = results.filter((result) => result.status === "fulfilled");
  const failures = results.filter((result) => result.status === "rejected");

  assert.equal(successes.length, 1, "Exactly one bidder should win a same-amount race");
  assert.equal(failures.length, 1, "Exactly one bidder should lose a same-amount race");

  const failureCode = failures[0]?.reason?.code;
  assert.ok(
    failureCode === "CONFLICT" || failureCode === "BAD_REQUEST",
    `Unexpected failure code in race: ${String(failureCode)}`,
  );

  const afterAuction = await db.auction.findUnique({
    where: { id: auction.id },
    select: { currentPriceCents: true, bidCount: true },
  });

  assert.ok(afterAuction, "Auction must exist after race");
  assert.equal(afterAuction.currentPriceCents, targetBidCents);
  assert.equal(afterAuction.bidCount, 1);

  const persistedBidCount = await db.bid.count({
    where: { auctionId: auction.id },
  });

  assert.equal(persistedBidCount, 1);
}

async function testHighContentionInvariants() {
  const seller = await createUser("seller-contention");
  const bidders = await Promise.all(
    Array.from({ length: 10 }, (_, idx) => createUser(`bidder-contention-${idx + 1}`)),
  );

  const auction = await createAuction({
    sellerId: seller.id,
    startPriceCents: 20_000,
    minIncrementCents: 100,
    endsAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  const attempts = bidders.map((bidder, idx) =>
    placeBidWithTransaction({
      auctionId: auction.id,
      bidderId: bidder.id,
      amountCents: 20_100 + idx * 100,
    }),
  );

  const results = await Promise.allSettled(attempts);
  const successfulBids = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value.amountCents);
  const failedResults = results.filter((result) => result.status === "rejected");

  assert.ok(successfulBids.length > 0, "At least one high-contention bid should succeed");

  for (const failed of failedResults) {
    const code = failed.reason?.code;
    assert.ok(
      code === "CONFLICT" || code === "BAD_REQUEST",
      `Unexpected failure code in contention test: ${String(code)}`,
    );
  }

  const finalAuction = await db.auction.findUnique({
    where: { id: auction.id },
    select: { currentPriceCents: true, bidCount: true },
  });
  const persistedBids = await db.bid.findMany({
    where: { auctionId: auction.id },
    select: { amountCents: true },
  });

  assert.ok(finalAuction, "Auction must exist after contention test");
  assert.equal(finalAuction.bidCount, persistedBids.length);
  assert.equal(finalAuction.bidCount, successfulBids.length);

  const maxPersistedBid = Math.max(...persistedBids.map((bid) => bid.amountCents));
  assert.equal(finalAuction.currentPriceCents, maxPersistedBid);
}

async function testSellerCannotBidOnOwnAuction() {
  const seller = await createUser("seller-self-bid");
  const auction = await createAuction({
    sellerId: seller.id,
    startPriceCents: 30_000,
    minIncrementCents: 100,
    endsAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  await assert.rejects(
    () =>
      placeBidWithTransaction({
        auctionId: auction.id,
        bidderId: seller.id,
        amountCents: 30_100,
      }),
    (error) => error instanceof BidError && error.code === "FORBIDDEN",
  );

  const bidCount = await db.bid.count({ where: { auctionId: auction.id } });
  assert.equal(bidCount, 0);
}

async function testExpiredAuctionRejectsBidAndEndsAuction() {
  const seller = await createUser("seller-expired");
  const bidder = await createUser("bidder-expired");
  const auction = await createAuction({
    sellerId: seller.id,
    startPriceCents: 40_000,
    minIncrementCents: 100,
    endsAt: new Date(Date.now() - 10_000),
  });

  await assert.rejects(
    () =>
      placeBidWithTransaction({
        auctionId: auction.id,
        bidderId: bidder.id,
        amountCents: 40_100,
      }),
    (error) => error instanceof BidError && error.code === "BAD_REQUEST",
  );

  const afterAuction = await db.auction.findUnique({
    where: { id: auction.id },
    select: { status: true, bidCount: true },
  });

  assert.ok(afterAuction, "Auction must exist after expiry test");
  assert.equal(afterAuction.status, "ENDED");
  assert.equal(afterAuction.bidCount, 0);

  const bidCount = await db.bid.count({ where: { auctionId: auction.id } });
  assert.equal(bidCount, 0);
}

async function main() {
  const startedAt = Date.now();
  console.log(`Running bid concurrency integration checks (${runTag})`);

  try {
    await runTest("same-amount race has exactly one winner", testSameAmountRace);
    await runTest("high-contention race preserves invariants", testHighContentionInvariants);
    await runTest("seller cannot bid on own auction", testSellerCannotBidOnOwnAuction);
    await runTest(
      "expired auction rejects bids and transitions to ENDED",
      testExpiredAuctionRejectsBidAndEndsAuction,
    );

    const elapsedMs = Date.now() - startedAt;
    console.log(`All concurrency checks passed in ${elapsedMs}ms.`);
  } finally {
    await cleanupTestData();
    await db.$disconnect();
  }
}

await main();
