#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

import {
  AuctionCategory,
  Prisma,
  PrismaClient,
} from "../generated/prisma/index.js";

const ENV_FILE_NAME = ".env";
const DEFAULT_BUCKET = "auction-images";
const LOCAL_SEED_IMAGES_DIR = "public/images/seed-auctions";
const LOCAL_SEED_MANIFEST_FILE = "manifest.json";
const VALID_AUCTION_CATEGORIES = new Set(Object.values(AuctionCategory));
const STARTING_BALANCE_CENTS = 5_000_000;
const SHORT_AUCTION_DURATION_HOURS = [46, 48, 50, 52, 54, 56];
const LONG_AUCTION_DURATION_HOURS = [120, 168, 216];
const BID_STEP_EXTRA_INCREMENT_PATTERN = [0, 1, 2, 1, 0, 3];
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const JPEG_QUALITY_CANDIDATES = [82, 76, 70, 64, 58, 52, 46];
const JPEG_RESAMPLE_WIDTHS = [null, 3200, 2800, 2400, 2000, 1600];
const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const execFileAsync = promisify(execFile);

function contentTypeForFileName(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  throw new Error(`Unsupported image extension for seed asset: ${fileName}`);
}

function normalizePositiveInteger(value, fieldName, fileName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid "${fieldName}" in ${LOCAL_SEED_MANIFEST_FILE} for "${fileName}".`,
    );
  }
  return value;
}

async function loadArtworkSeedData(imagesDirectory) {
  const manifestPath = path.join(imagesDirectory, LOCAL_SEED_MANIFEST_FILE);
  const manifestRaw = await fs.readFile(manifestPath, "utf8");
  const parsed = JSON.parse(manifestRaw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      `${LOCAL_SEED_MANIFEST_FILE} must contain a non-empty JSON array.`,
    );
  }

  return parsed.map((entry, index) => {
    const fileName =
      typeof entry?.fileName === "string" ? entry.fileName.trim() : "";
    if (!fileName) {
      throw new Error(
        `Missing "fileName" for manifest item #${index + 1} in ${LOCAL_SEED_MANIFEST_FILE}.`,
      );
    }
    if (path.isAbsolute(fileName) || fileName.includes("..")) {
      throw new Error(
        `Invalid "fileName" in ${LOCAL_SEED_MANIFEST_FILE}: "${fileName}".`,
      );
    }

    const category =
      typeof entry?.category === "string" ? entry.category : undefined;
    if (!category || !VALID_AUCTION_CATEGORIES.has(category)) {
      throw new Error(
        `Invalid "category" in ${LOCAL_SEED_MANIFEST_FILE} for "${fileName}".`,
      );
    }

    const title = typeof entry?.title === "string" ? entry.title.trim() : "";
    const description =
      typeof entry?.description === "string" ? entry.description.trim() : "";
    const dimensions =
      typeof entry?.dimensions === "string" ? entry.dimensions.trim() : "";
    const condition =
      typeof entry?.condition === "string" ? entry.condition.trim() : "";

    if (!title || !description || !dimensions || !condition) {
      throw new Error(
        `Manifest item "${fileName}" is missing one of: title, description, dimensions, or condition.`,
      );
    }

    const artworkYear = normalizePositiveInteger(
      entry.artworkYear,
      "artworkYear",
      fileName,
    );
    const startPriceCents = normalizePositiveInteger(
      entry.startPriceCents,
      "startPriceCents",
      fileName,
    );
    const minIncrementCents = normalizePositiveInteger(
      entry.minIncrementCents,
      "minIncrementCents",
      fileName,
    );
    const durationHours = normalizePositiveInteger(
      entry.durationHours,
      "durationHours",
      fileName,
    );

    return {
      fileName,
      title,
      description,
      category,
      dimensions,
      condition,
      artworkYear,
      startPriceCents,
      minIncrementCents,
      durationHours,
    };
  });
}

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

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "");
}

function parseSeedEmails() {
  const rawEmails = process.env.DEMO_AUCTION_SEED_EMAILS;
  if (!rawEmails) return [];
  return rawEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

async function resolveTargetUsers(prisma) {
  const explicitEmails = parseSeedEmails();

  if (explicitEmails.length > 0) {
    const users = await prisma.user.findMany({
      where: {
        email: { in: explicitEmails },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
    const missingEmails = explicitEmails.filter((email) => !byEmail.has(email));
    if (missingEmails.length > 0) {
      throw new Error(
        `Could not find users for emails: ${missingEmails.join(", ")}`,
      );
    }

    return explicitEmails.map((email) => byEmail.get(email));
  }

  const users = await prisma.user.findMany({
    where: {
      email: {
        startsWith: "demo.bidder.",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (users.length === 0) {
    throw new Error(
      'No demo bidder users found. Create them first on /login with "Create 5 Demo Users".',
    );
  }

  return [...users].reverse();
}

function resolveMaxUploadBytes() {
  const rawMegabytes = process.env.SUPABASE_BUCKET_MAX_UPLOAD_MB;
  if (!rawMegabytes) {
    return DEFAULT_MAX_UPLOAD_SIZE_BYTES;
  }

  const parsedMegabytes = Number(rawMegabytes);
  if (!Number.isFinite(parsedMegabytes) || parsedMegabytes <= 0) {
    throw new Error(
      "SUPABASE_BUCKET_MAX_UPLOAD_MB must be a positive number when set.",
    );
  }

  return Math.floor(parsedMegabytes * 1024 * 1024);
}

function formatUsd(cents) {
  return usdFormatter.format(cents / 100);
}

function endingOffsetHoursForAuction(auctionIndex) {
  const isLongAuction = (auctionIndex + 1) % 6 === 0;
  if (isLongAuction) {
    return LONG_AUCTION_DURATION_HOURS[
      Math.floor(auctionIndex / 6) % LONG_AUCTION_DURATION_HOURS.length
    ];
  }
  return SHORT_AUCTION_DURATION_HOURS[
    auctionIndex % SHORT_AUCTION_DURATION_HOURS.length
  ];
}

function plannedBidCountForAuction(auctionIndex) {
  if ((auctionIndex + 1) % 10 === 0) {
    return 0;
  }
  return 2 + (auctionIndex % 4);
}

function nextBidAmountCents(auctionState, auctionIndex, bidIndex) {
  const minimumNextBidCents =
    auctionState.currentPriceCents + auctionState.minIncrementCents;
  const extraIncrementCount =
    BID_STEP_EXTRA_INCREMENT_PATTERN[
      (auctionIndex + bidIndex) % BID_STEP_EXTRA_INCREMENT_PATTERN.length
    ];
  return (
    minimumNextBidCents + extraIncrementCount * auctionState.minIncrementCents
  );
}

function orderedBidderCandidates(
  bidderIds,
  preferredBidderId,
  currentLeadingBidderId,
) {
  const prioritized = [
    preferredBidderId,
    ...bidderIds.filter((bidderId) => bidderId !== preferredBidderId),
  ];

  if (prioritized.length <= 1 || prioritized[0] !== currentLeadingBidderId) {
    return prioritized;
  }

  const firstDifferentBidder = prioritized.find(
    (bidderId) => bidderId !== currentLeadingBidderId,
  );
  if (!firstDifferentBidder) {
    return prioritized;
  }

  return [
    firstDifferentBidder,
    ...prioritized.filter((bidderId) => bidderId !== firstDifferentBidder),
  ];
}

function requiredAdditionalHoldCents({
  bidderId,
  amountCents,
  currentLeadingBid,
}) {
  if (!currentLeadingBid || currentLeadingBid.bidderId !== bidderId) {
    return amountCents;
  }
  return amountCents - currentLeadingBid.amountCents;
}

async function resetBalancesForSeedUsers(prisma, users) {
  await prisma.user.updateMany({
    where: {
      id: {
        in: users.map((user) => user.id),
      },
    },
    data: {
      availableBalanceCents: STARTING_BALANCE_CENTS,
      reservedBalanceCents: 0,
    },
  });

  return new Map(
    users.map((user) => [
      user.id,
      {
        availableBalanceCents: STARTING_BALANCE_CENTS,
        reservedBalanceCents: 0,
      },
    ]),
  );
}

async function placeSeedBid({
  prisma,
  auctionState,
  bidderId,
  amountCents,
  userBalancesById,
}) {
  const currentLeadingBid = auctionState.leadingBid;
  const requiredHold = requiredAdditionalHoldCents({
    bidderId,
    amountCents,
    currentLeadingBid,
  });
  const bidderBalances = userBalancesById.get(bidderId);

  if (!bidderBalances) {
    throw new Error(`Unknown bidder ID while seeding bids: ${bidderId}`);
  }

  if (requiredHold > bidderBalances.availableBalanceCents) {
    return false;
  }

  await prisma.$transaction(
    async (tx) => {
      if (requiredHold > 0) {
        const reserveResult = await tx.user.updateMany({
          where: {
            id: bidderId,
            availableBalanceCents: { gte: requiredHold },
          },
          data: {
            availableBalanceCents: { decrement: requiredHold },
            reservedBalanceCents: { increment: requiredHold },
          },
        });

        if (reserveResult.count !== 1) {
          throw new Error("Insufficient available balance while seeding bids.");
        }
      }

      const auctionUpdateResult = await tx.auction.updateMany({
        where: {
          id: auctionState.id,
          status: "LIVE",
          currentPriceCents: auctionState.currentPriceCents,
        },
        data: {
          currentPriceCents: amountCents,
          bidCount: { increment: 1 },
        },
      });

      if (auctionUpdateResult.count !== 1) {
        throw new Error(
          `Failed to update auction price while seeding bids for ${auctionState.id}.`,
        );
      }

      if (currentLeadingBid && currentLeadingBid.bidderId !== bidderId) {
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
          throw new Error(
            `Failed to release previous leading hold for ${currentLeadingBid.bidderId}.`,
          );
        }
      }

      await tx.bid.create({
        data: {
          auctionId: auctionState.id,
          bidderId,
          amountCents,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  bidderBalances.availableBalanceCents -= requiredHold;
  bidderBalances.reservedBalanceCents += requiredHold;

  if (currentLeadingBid && currentLeadingBid.bidderId !== bidderId) {
    const previousLeaderBalances = userBalancesById.get(currentLeadingBid.bidderId);
    if (!previousLeaderBalances) {
      throw new Error(
        `Unknown previous leading bidder ID while seeding bids: ${currentLeadingBid.bidderId}`,
      );
    }
    previousLeaderBalances.availableBalanceCents += currentLeadingBid.amountCents;
    previousLeaderBalances.reservedBalanceCents -= currentLeadingBid.amountCents;
  }

  auctionState.currentPriceCents = amountCents;
  auctionState.bidCount += 1;
  auctionState.leadingBid = {
    bidderId,
    amountCents,
  };

  return true;
}

async function seedBidLadderForAuction({
  prisma,
  auctionIndex,
  auctionState,
  users,
  userBalancesById,
}) {
  const bidderIds = users
    .filter((user) => user.id !== auctionState.sellerId)
    .map((user) => user.id);

  if (bidderIds.length === 0) {
    return 0;
  }

  const plannedBidCount = plannedBidCountForAuction(auctionIndex);
  let placedBidCount = 0;

  for (let bidIndex = 0; bidIndex < plannedBidCount; bidIndex += 1) {
    const amountCents = nextBidAmountCents(auctionState, auctionIndex, bidIndex);
    const preferredBidderId = bidderIds[(auctionIndex + bidIndex) % bidderIds.length];
    const candidates = orderedBidderCandidates(
      bidderIds,
      preferredBidderId,
      auctionState.leadingBid?.bidderId,
    );

    let selectedBidderId = null;

    for (const candidateId of candidates) {
      const candidateBalances = userBalancesById.get(candidateId);
      if (!candidateBalances) {
        continue;
      }

      const requiredHold = requiredAdditionalHoldCents({
        bidderId: candidateId,
        amountCents,
        currentLeadingBid: auctionState.leadingBid,
      });

      if (candidateBalances.availableBalanceCents >= requiredHold) {
        selectedBidderId = candidateId;
        break;
      }
    }

    if (!selectedBidderId) {
      break;
    }

    const placed = await placeSeedBid({
      prisma,
      auctionState,
      bidderId: selectedBidderId,
      amountCents,
      userBalancesById,
    });
    if (!placed) {
      break;
    }

    placedBidCount += 1;
  }

  return placedBidCount;
}

function isJpegFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return extension === ".jpg" || extension === ".jpeg";
}

async function buildCompressedJpegBuffer({
  inputPath,
  targetMaxBytes,
  fileName,
}) {
  if (process.platform !== "darwin") {
    return null;
  }

  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "seed-auctions-compress-"),
  );

  try {
    for (const width of JPEG_RESAMPLE_WIDTHS) {
      for (const quality of JPEG_QUALITY_CANDIDATES) {
        const outputPath = path.join(
          tempDirectory,
          `${path.basename(fileName, path.extname(fileName))}-${width ?? "orig"}-${quality}.jpg`,
        );

        const commandArgs = [inputPath];
        if (width !== null) {
          commandArgs.push("--resampleWidth", String(width));
        }
        commandArgs.push(
          "-s",
          "format",
          "jpeg",
          "--setProperty",
          "formatOptions",
          String(quality),
          "--out",
          outputPath,
        );

        await execFileAsync("sips", commandArgs);

        const outputStats = await fs.stat(outputPath);
        if (outputStats.size <= targetMaxBytes) {
          const buffer = await fs.readFile(outputPath);
          return {
            buffer,
            quality,
            width,
            sizeBytes: buffer.length,
          };
        }
      }
    }
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }

  return null;
}

async function resolveUploadBuffer({
  inputPath,
  fileName,
  maxUploadBytes,
}) {
  const originalBuffer = await fs.readFile(inputPath);
  if (originalBuffer.length <= maxUploadBytes) {
    return { buffer: originalBuffer, compressed: false };
  }

  if (!isJpegFile(fileName)) {
    throw new Error(
      `Seed image ${fileName} is ${originalBuffer.length} bytes and exceeds configured upload limit ${maxUploadBytes} bytes.`,
    );
  }

  const compressed = await buildCompressedJpegBuffer({
    inputPath,
    targetMaxBytes: maxUploadBytes,
    fileName,
  });

  if (!compressed) {
    throw new Error(
      `Could not compress ${fileName} under ${maxUploadBytes} bytes. Increase bucket file-size limit.`,
    );
  }

  return {
    buffer: compressed.buffer,
    compressed: true,
    compressedSizeBytes: compressed.sizeBytes,
    quality: compressed.quality,
    width: compressed.width,
  };
}

async function main() {
  await loadLocalEnvFile();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Add it to your environment.");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for artwork seeding.",
    );
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  const maxUploadBytes = resolveMaxUploadBytes();
  const imagesDirectory = path.resolve(
    process.cwd(),
    LOCAL_SEED_IMAGES_DIR,
  );
  const artworkSeedData = await loadArtworkSeedData(imagesDirectory);

  const prisma = new PrismaClient();
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const users = await resolveTargetUsers(prisma);
    const userBalancesById = await resetBalancesForSeedUsers(prisma, users);
    const now = Date.now();
    const createdAuctions = [];
    let totalSeededBids = 0;
    let compressedUploadCount = 0;

    for (let index = 0; index < artworkSeedData.length; index += 1) {
      const artwork = artworkSeedData[index];
      const seller = users[index % users.length];
      if (!seller) {
        throw new Error("Could not resolve seller for seeded auction.");
      }

      const localImagePath = path.join(imagesDirectory, artwork.fileName);
      const uploadAsset = await resolveUploadBuffer({
        inputPath: localImagePath,
        fileName: artwork.fileName,
        maxUploadBytes,
      });
      const extension = path.extname(artwork.fileName).toLowerCase();
      const contentType = contentTypeForFileName(artwork.fileName);

      const safeTitle = slugify(artwork.title);
      const storagePath = `${seller.id}/seed/${safeTitle}-${randomUUID()}${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, uploadAsset.buffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload ${artwork.fileName} to Supabase: ${uploadError.message}`,
        );
      }
      if (uploadAsset.compressed) {
        compressedUploadCount += 1;
        console.log(
          `[seed-demo-auctions] Compressed ${artwork.fileName} for upload (${uploadAsset.compressedSizeBytes} bytes, quality ${uploadAsset.quality}, width ${uploadAsset.width ?? "original"}).`,
        );
      }

      const startsAt = new Date(now - ((index % 8) + 1) * 60 * 60 * 1000);
      const endsAt = new Date(
        now + endingOffsetHoursForAuction(index) * 60 * 60 * 1000,
      );

      const auction = await prisma.auction.create({
        data: {
          sellerId: seller.id,
          title: artwork.title,
          description: artwork.description,
          category: artwork.category,
          dimensions: artwork.dimensions,
          condition: artwork.condition,
          artworkYear: artwork.artworkYear,
          imagePath: storagePath,
          startPriceCents: artwork.startPriceCents,
          currentPriceCents: artwork.startPriceCents,
          minIncrementCents: artwork.minIncrementCents,
          startsAt,
          endsAt,
          status: "LIVE",
        },
        select: {
          id: true,
          title: true,
          category: true,
          sellerId: true,
          currentPriceCents: true,
          minIncrementCents: true,
          bidCount: true,
          endsAt: true,
          seller: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      const auctionState = {
        id: auction.id,
        sellerId: auction.sellerId,
        currentPriceCents: auction.currentPriceCents,
        minIncrementCents: auction.minIncrementCents,
        bidCount: auction.bidCount,
        leadingBid: null,
      };

      const seededBidCount = await seedBidLadderForAuction({
        prisma,
        auctionIndex: index,
        auctionState,
        users,
        userBalancesById,
      });

      totalSeededBids += seededBidCount;
      createdAuctions.push({
        ...auction,
        seededBidCount,
      });
    }

    console.log(
      `[seed-demo-auctions] Created ${createdAuctions.length} auctions in bucket "${bucket}".`,
    );
    for (const auction of createdAuctions) {
      console.log(
        `- ${auction.title} [${auction.category}] by ${auction.seller.name} (${auction.seller.email}) | ${auction.seededBidCount} bids | ends ${auction.endsAt.toISOString()}`,
      );
    }
    console.log(`[seed-demo-auctions] Seeded ${totalSeededBids} bids total.`);
    console.log(
      `[seed-demo-auctions] Compressed ${compressedUploadCount} oversized images to satisfy bucket limits.`,
    );
    console.log(
      `[seed-demo-auctions] Reset ${users.length} demo users to ${formatUsd(STARTING_BALANCE_CENTS)} each before seeding.`,
    );
    for (const user of users) {
      const balances = userBalancesById.get(user.id);
      if (!balances) continue;
      console.log(
        `  · ${user.name} (${user.email}) -> available ${formatUsd(balances.availableBalanceCents)}, reserved ${formatUsd(balances.reservedBalanceCents)}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[seed-demo-auctions] Failed:", error);
  process.exitCode = 1;
});
