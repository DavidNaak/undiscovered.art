#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../generated/prisma/index.js";

const ENV_FILE_NAME = ".env";
const STORAGE_DELETE_BATCH_SIZE = 100;

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const firstEqualsIndex = trimmed.indexOf("=");
  if (firstEqualsIndex === -1) return null;

  const key = trimmed.slice(0, firstEqualsIndex).trim();
  if (!key) return null;

  let value = trimmed.slice(firstEqualsIndex + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  } else {
    const commentIndex = value.indexOf(" #");
    if (commentIndex >= 0) {
      value = value.slice(0, commentIndex).trim();
    }
  }

  return { key, value };
}

async function loadLocalEnvFile() {
  const envPath = path.resolve(process.cwd(), ENV_FILE_NAME);
  let contents = "";
  try {
    contents = await fs.readFile(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split(/\r?\n/u)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function chunk(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function deleteUploadedArtwork(imagePaths) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "auction-images";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.log(
      "[reset-auction-data] Skipping Supabase object cleanup (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).",
    );
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const batches = chunk(imagePaths, STORAGE_DELETE_BATCH_SIZE);
  let deletedCount = 0;

  for (const batch of batches) {
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.warn(
        `[reset-auction-data] Failed to delete batch from storage bucket "${bucket}": ${error.message}`,
      );
      continue;
    }
    deletedCount += data?.length ?? 0;
  }

  console.log(
    `[reset-auction-data] Deleted ${deletedCount}/${imagePaths.length} stored artwork objects from "${bucket}".`,
  );
}

async function main() {
  await loadLocalEnvFile();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Add it to your environment.");
  }

  const prisma = new PrismaClient();

  try {
    const existingAuctions = await prisma.auction.findMany({
      select: {
        imagePath: true,
      },
    });
    const imagePaths = existingAuctions.map((auction) => auction.imagePath);

    const [deletedBidResult, deletedAuctionResult] = await prisma.$transaction(
      async (tx) => {
        const deletedBidRows = await tx.bid.deleteMany({});
        const deletedAuctionRows = await tx.auction.deleteMany({});

        await tx.$executeRawUnsafe(`
          UPDATE "user"
          SET
            "availableBalanceCents" = "availableBalanceCents" + "reservedBalanceCents",
            "reservedBalanceCents" = 0
        `);

        return [deletedBidRows, deletedAuctionRows];
      },
    );

    console.log(
      `[reset-auction-data] Deleted ${deletedBidResult.count} bids and ${deletedAuctionResult.count} auctions.`,
    );
    console.log(
      "[reset-auction-data] Returned all reserved balances back to users' available balances.",
    );

    if (imagePaths.length > 0) {
      await deleteUploadedArtwork(imagePaths);
    } else {
      console.log("[reset-auction-data] No stored artwork paths to clean up.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[reset-auction-data] Failed:", error);
  process.exitCode = 1;
});
