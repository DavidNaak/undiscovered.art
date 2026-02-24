#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { AuctionCategory, PrismaClient } from "../generated/prisma/index.js";

const ENV_FILE_NAME = ".env";
const DEFAULT_BUCKET = "auction-images";

const ARTWORK_SEED_DATA = [
  {
    fileName: "artwork-1.jpg",
    title: "Terracotta Dreams",
    description:
      "Abstract oil on canvas with warm earth tones and thick impasto brushwork. 48x36 inches.",
    category: AuctionCategory.PAINTING,
    startPriceCents: 240_000,
    minIncrementCents: 5_000,
    durationHours: 8,
  },
  {
    fileName: "artwork-2.jpg",
    title: "Still Waters",
    description:
      "Minimalist watercolor capturing a serene lakeside at dawn. Delicate washes on cold-pressed paper.",
    category: AuctionCategory.DRAWING,
    startPriceCents: 85_000,
    minIncrementCents: 2_500,
    durationHours: 14,
  },
  {
    fileName: "artwork-3.jpg",
    title: "Form in Motion",
    description:
      "Patinated bronze figure exploring the tension between stillness and movement. Limited edition 3/12.",
    category: AuctionCategory.SCULPTURE,
    startPriceCents: 520_000,
    minIncrementCents: 10_000,
    durationHours: 20,
  },
  {
    fileName: "artwork-4.jpg",
    title: "Chromatic Shift #07",
    description:
      "Generative artwork exploring geometric harmony through algorithmic composition. 4K archival print.",
    category: AuctionCategory.DIGITAL_ART,
    startPriceCents: 110_000,
    minIncrementCents: 2_500,
    durationHours: 26,
  },
  {
    fileName: "artwork-5.jpg",
    title: "Silent Witness",
    description:
      "Gelatin silver print on fiber-based paper. Dramatic chiaroscuro portrait from the Solitude series.",
    category: AuctionCategory.PHOTOGRAPHY,
    startPriceCents: 180_000,
    minIncrementCents: 5_000,
    durationHours: 34,
  },
  {
    fileName: "artwork-6.jpg",
    title: "Palimpsest IV",
    description:
      "Layered mixed media combining acrylic, found paper, and wax on panel. 30x24 inches.",
    category: AuctionCategory.MIXED_MEDIA,
    startPriceCents: 310_000,
    minIncrementCents: 7_500,
    durationHours: 42,
  },
];

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
    "EXAMPLE_UI/public/images",
  );

  const prisma = new PrismaClient();
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const users = await resolveTargetUsers(prisma);
    const now = Date.now();
    const createdAuctions = [];

    for (let index = 0; index < ARTWORK_SEED_DATA.length; index += 1) {
      const artwork = ARTWORK_SEED_DATA[index];
      const seller = users[index % users.length];
      if (!seller) {
        throw new Error("Could not resolve seller for seeded auction.");
      }

      const localImagePath = path.join(imagesDirectory, artwork.fileName);
      const imageBuffer = await fs.readFile(localImagePath);

      const safeTitle = slugify(artwork.title);
      const storagePath = `${seller.id}/seed/${safeTitle}-${randomUUID()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, imageBuffer, {
          contentType: "image/jpeg",
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
