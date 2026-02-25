#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { AuctionCategory, PrismaClient } from "../generated/prisma/index.js";

const ENV_FILE_NAME = ".env";
const DEFAULT_BUCKET = "auction-images";
const LOCAL_SEED_IMAGES_DIR = "public/images/seed-auctions";
const LOCAL_SEED_MANIFEST_FILE = "manifest.json";
const VALID_AUCTION_CATEGORIES = new Set(Object.values(AuctionCategory));

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
    const now = Date.now();
    const createdAuctions = [];

    for (let index = 0; index < artworkSeedData.length; index += 1) {
      const artwork = artworkSeedData[index];
      const seller = users[index % users.length];
      if (!seller) {
        throw new Error("Could not resolve seller for seeded auction.");
      }

      const localImagePath = path.join(imagesDirectory, artwork.fileName);
      const imageBuffer = await fs.readFile(localImagePath);
      const extension = path.extname(artwork.fileName).toLowerCase();
      const contentType = contentTypeForFileName(artwork.fileName);

      const safeTitle = slugify(artwork.title);
      const storagePath = `${seller.id}/seed/${safeTitle}-${randomUUID()}${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, imageBuffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload ${artwork.fileName} to Supabase: ${uploadError.message}`,
        );
      }

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
          startsAt: new Date(now),
          endsAt: new Date(now + artwork.durationHours * 60 * 60 * 1000),
          status: "LIVE",
        },
        select: {
          id: true,
          title: true,
          category: true,
          seller: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      createdAuctions.push(auction);
    }

    console.log(
      `[seed-demo-auctions] Created ${createdAuctions.length} auctions in bucket "${bucket}".`,
    );
    for (const auction of createdAuctions) {
      console.log(
        `- ${auction.title} [${auction.category}] by ${auction.seller.name} (${auction.seller.email})`,
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
