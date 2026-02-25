#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "../generated/prisma/index.js";

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

function toInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callSettlementCron(baseUrl, cronSecret) {
  const headers = {};
  if (cronSecret) {
    headers.authorization = `Bearer ${cronSecret}`;
  }

  try {
    const response = await fetch(`${baseUrl}/api/cron/settle-auctions`, {
      method: "GET",
      headers,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Cron endpoint returned ${response.status}. Payload: ${JSON.stringify(payload)}`,
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Could not reach ${baseUrl}/api/cron/settle-auctions. Start the app with 'pnpm dev' and retry.`,
      );
    }
    throw error;
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. Add it to .env before running this test.");
  process.exit(1);
}

const STARTING_BALANCE_CENTS = 100000;
const TEST_BID_CENTS = 1200;
const auctionOffsetMs = toInt(process.env.SETTLEMENT_TEST_AUCTION_OFFSET_MS, 65_000);
const settleBufferMs = toInt(process.env.SETTLEMENT_TEST_FINALIZE_BUFFER_MS, 2_500);
const baseUrl = (process.env.SETTLEMENT_CRON_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const runTag = `settlement-cron-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

const db = new PrismaClient();

async function main() {
  const sellerId = `seller-${runTag}`;
  const bidderId = `bidder-${runTag}`;
  let auctionId = null;

  try {
    const now = new Date();
    const endsAt = new Date(now.getTime() + auctionOffsetMs);

    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: sellerId,
          name: `Seller ${runTag}`,
          email: `seller.${runTag}@example.com`,
          availableBalanceCents: STARTING_BALANCE_CENTS,
          reservedBalanceCents: 0,
        },
      });

      await tx.user.create({
        data: {
          id: bidderId,
          name: `Bidder ${runTag}`,
          email: `bidder.${runTag}@example.com`,
          availableBalanceCents: STARTING_BALANCE_CENTS,
          reservedBalanceCents: 0,
        },
      });

      const auction = await tx.auction.create({
        data: {
          sellerId,
          title: `Settlement Test ${runTag}`,
          description: "Integration test for cron settlement",
          category: "PAINTING",
          imagePath: `${sellerId}/test-settlement-${runTag}.jpg`,
          startPriceCents: 1000,
          currentPriceCents: 1000,
          minIncrementCents: 100,
          endsAt,
          status: "LIVE",
        },
        select: { id: true },
      });

      auctionId = auction.id;

      await tx.user.update({
        where: { id: bidderId },
        data: {
          availableBalanceCents: { decrement: TEST_BID_CENTS },
          reservedBalanceCents: { increment: TEST_BID_CENTS },
        },
      });

      await tx.bid.create({
        data: {
          auctionId,
          bidderId,
          amountCents: TEST_BID_CENTS,
        },
      });

      await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentPriceCents: TEST_BID_CENTS,
          bidCount: 1,
        },
      });
    });

    console.log(`[test-settlement-cron] Created auction ${auctionId} ending at ${new Date(Date.now() + auctionOffsetMs).toISOString()}`);

    const waitMs = auctionOffsetMs + settleBufferMs;
    console.log(`[test-settlement-cron] Waiting ${waitMs}ms for auction to expire...`);
    await sleep(waitMs);

    const cronPayload = await callSettlementCron(baseUrl, process.env.CRON_SECRET ?? "");
    console.log("[test-settlement-cron] Cron response:", cronPayload);

    const [auction, seller, bidder] = await Promise.all([
      db.auction.findUnique({
        where: { id: auctionId },
        select: {
          status: true,
          settledAt: true,
          currentPriceCents: true,
          bidCount: true,
        },
      }),
      db.user.findUnique({
        where: { id: sellerId },
        select: {
          availableBalanceCents: true,
          reservedBalanceCents: true,
        },
      }),
      db.user.findUnique({
        where: { id: bidderId },
        select: {
          availableBalanceCents: true,
          reservedBalanceCents: true,
        },
      }),
    ]);

    assert.ok(auction, "Auction should exist");
    assert.equal(auction.status, "ENDED", "Auction should be settled to ENDED");
    assert.ok(auction.settledAt, "Auction should have settledAt timestamp");
    assert.equal(auction.currentPriceCents, TEST_BID_CENTS);
    assert.equal(auction.bidCount, 1);

    assert.ok(seller, "Seller should exist");
    assert.equal(
      seller.availableBalanceCents,
      STARTING_BALANCE_CENTS + TEST_BID_CENTS,
      "Seller should receive winning amount",
    );
    assert.equal(seller.reservedBalanceCents, 0);

    assert.ok(bidder, "Bidder should exist");
    assert.equal(
      bidder.availableBalanceCents,
      STARTING_BALANCE_CENTS - TEST_BID_CENTS,
      "Bidder available should remain debited after settlement",
    );
    assert.equal(
      bidder.reservedBalanceCents,
      0,
      "Bidder reserved hold should be cleared after settlement",
    );

    console.log("[test-settlement-cron] PASS");
  } finally {
    if (auctionId) {
      await db.bid.deleteMany({ where: { auctionId } });
      await db.auction.deleteMany({ where: { id: auctionId } });
    }

    await db.user.deleteMany({ where: { id: { in: [sellerId, bidderId] } } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("[test-settlement-cron] FAIL", error);
  process.exitCode = 1;
});
