#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const OUTPUT_DIR = path.resolve(process.cwd(), "public/images/seed-auctions");
const MANIFEST_FILE_NAME = "manifest.json";
const SEARCH_ENDPOINT =
  "https://collectionapi.metmuseum.org/public/collection/v1/search";
const OBJECT_ENDPOINT =
  "https://collectionapi.metmuseum.org/public/collection/v1/objects";

const DEFAULT_COUNT = 30;
const DEFAULT_QUERY = "";
const OBJECT_SCAN_LIMIT = 1_200;
const REQUEST_DELAY_MS = 45;

const SUPPORTED_CATEGORIES = [
  "PAINTING",
  "SCULPTURE",
  "PHOTOGRAPHY",
  "DIGITAL_ART",
  "MIXED_MEDIA",
  "DRAWING",
];

const CATEGORY_LABELS = {
  PAINTING: "Painting",
  SCULPTURE: "Sculpture",
  PHOTOGRAPHY: "Photography",
  DIGITAL_ART: "Digital Art",
  MIXED_MEDIA: "Mixed Media",
  DRAWING: "Drawing",
};

const CATEGORY_CONFIG = {
  PAINTING: {
    queryTerms: ["painting", "oil painting", "watercolor"],
    mediumTerms: ["Paintings"],
    matchTerms: ["painting", "oil on canvas", "watercolor", "tempera", "acrylic", "gouache"],
    basePriceCents: 170_000,
  },
  SCULPTURE: {
    queryTerms: ["sculpture", "bronze sculpture", "marble sculpture"],
    mediumTerms: ["Sculpture"],
    matchTerms: [
      "sculpture",
      "statuette",
      "bronze",
      "marble",
      "terracotta",
      "carved",
      "relief",
    ],
    basePriceCents: 240_000,
  },
  PHOTOGRAPHY: {
    queryTerms: ["photograph", "photography", "gelatin silver"],
    mediumTerms: ["Photographs"],
    matchTerms: [
      "photograph",
      "photography",
      "gelatin silver",
      "albumen",
      "daguerreotype",
      "chromogenic",
      "photogravure",
    ],
    basePriceCents: 110_000,
  },
  DIGITAL_ART: {
    queryTerms: ["digital art", "screenprint", "lithograph", "printmaking"],
    mediumTerms: ["Prints"],
    matchTerms: [
      "digital",
      "screenprint",
      "lithograph",
      "serigraph",
      "etching",
      "aquatint",
      "woodcut",
      "linocut",
      "engraving",
      "print",
    ],
    basePriceCents: 130_000,
  },
  MIXED_MEDIA: {
    queryTerms: ["mixed media", "collage", "assemblage"],
    mediumTerms: ["Collages"],
    matchTerms: [
      "mixed media",
      "collage",
      "assemblage",
      "mixed technique",
      "found object",
      "papier colle",
      "combination",
    ],
    basePriceCents: 150_000,
  },
  DRAWING: {
    queryTerms: ["drawing", "charcoal drawing", "ink drawing"],
    mediumTerms: ["Drawings"],
    matchTerms: ["drawing", "graphite", "ink", "charcoal", "chalk", "pastel", "crayon"],
    basePriceCents: 95_000,
  },
};

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function stripWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toKebab(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function includesAny(haystack, terms) {
  return terms.some((term) => haystack.includes(term));
}

function composeSearchQuery(globalQuery, term) {
  if (!globalQuery) return term;
  return `${globalQuery} ${term}`;
}

function normalizeCategoryName(value) {
  return stripWhitespace(value).toUpperCase().replace(/[\s-]+/g, "_");
}

function parseCategories(rawValue) {
  if (!rawValue) return [...SUPPORTED_CATEGORIES];

  const values = rawValue
    .split(",")
    .map((value) => normalizeCategoryName(value))
    .filter((value) => value.length > 0);

  const uniqueValues = [...new Set(values)];
  if (uniqueValues.length === 0) {
    throw new Error(
      "SEED_AUCTION_CATEGORIES was provided but no valid categories were found.",
    );
  }

  const invalidValues = uniqueValues.filter(
    (value) => !SUPPORTED_CATEGORIES.includes(value),
  );
  if (invalidValues.length > 0) {
    throw new Error(
      `Invalid categories: ${invalidValues.join(", ")}. Valid values: ${SUPPORTED_CATEGORIES.join(", ")}`,
    );
  }

  return uniqueValues;
}

function distributeTargetAcrossCategories(categories, totalCount) {
  const distribution = new Map();
  const base = Math.floor(totalCount / categories.length);
  let remainder = totalCount % categories.length;

  for (const category of categories) {
    const count = base + (remainder > 0 ? 1 : 0);
    distribution.set(category, count);
    if (remainder > 0) remainder -= 1;
  }

  return distribution;
}

function pickDimensions(raw) {
  if (!raw) return "Unknown";
  const cleaned = stripWhitespace(raw);
  if (!cleaned) return "Unknown";
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

function resolveArtworkYear(object) {
  const nowYear = new Date().getFullYear();

  const endDate = Number(object?.objectEndDate);
  if (Number.isInteger(endDate) && endDate > 0 && endDate <= nowYear) {
    return endDate;
  }

  const beginDate = Number(object?.objectBeginDate);
  if (Number.isInteger(beginDate) && beginDate > 0 && beginDate <= nowYear) {
    return beginDate;
  }

  const dateMatch = stripWhitespace(object?.objectDate).match(
    /(1[0-9]{3}|20[0-9]{2})/,
  );
  if (dateMatch) {
    const year = Number.parseInt(dateMatch[1], 10);
    if (year > 0 && year <= nowYear) return year;
  }

  return nowYear;
}

function extensionForImageResponse(response, imageUrl) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/webp")) return ".webp";

  const pathname = new URL(imageUrl).pathname.toLowerCase();
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return ".jpg";
  if (pathname.endsWith(".png")) return ".png";
  if (pathname.endsWith(".webp")) return ".webp";
  return ".jpg";
}

function shuffleInPlace(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

function buildSearchText(object) {
  const parts = [
    object?.classification,
    object?.objectName,
    object?.medium,
    object?.title,
    object?.department,
    object?.culture,
  ]
    .map((value) => stripWhitespace(value).toLowerCase())
    .filter((value) => value.length > 0);
  return parts.join(" ");
}

function isUsableObjectForCategory(object, category) {
  if (!object || object.isPublicDomain !== true) return false;
  if (!(object.primaryImage || object.primaryImageSmall)) return false;

  const config = CATEGORY_CONFIG[category];
  if (!config) return false;

  const searchText = buildSearchText(object);
  if (!searchText) return false;

  return includesAny(searchText, config.matchTerms);
}

function createManifestItem({ object, fileName, category, globalIndex, categoryIndex }) {
  const config = CATEGORY_CONFIG[category];
  const artist = stripWhitespace(object.artistDisplayName || "Unknown artist");
  const objectDate = stripWhitespace(object.objectDate || "Undated");
  const medium = stripWhitespace(object.medium || CATEGORY_LABELS[category]);
  const title =
    stripWhitespace(object.title) || `${CATEGORY_LABELS[category]} Study ${globalIndex + 1}`;
  const artworkYear = resolveArtworkYear(object);

  const startPriceCents =
    config.basePriceCents + categoryIndex * 8_500 + (globalIndex % 4) * 4_000;
  const minIncrementCents =
    startPriceCents >= 350_000
      ? 10_000
      : startPriceCents >= 180_000
        ? 5_000
        : 2_500;

  const conditionOptions = ["MINT", "EXCELLENT", "VERY_GOOD", "GOOD"];
  const condition = conditionOptions[(globalIndex + categoryIndex) % conditionOptions.length];

  return {
    fileName,
    title,
    description: `${artist}, ${objectDate}. ${medium}. Public domain image from The Met Open Access collection.`,
    category,
    dimensions: pickDimensions(object.dimensions),
    condition,
    artworkYear,
    startPriceCents,
    minIncrementCents,
    durationHours: 12 + ((globalIndex + categoryIndex) % 10) * 3,
    source: "The Metropolitan Museum of Art Open Access",
    sourceUrl: object.objectURL ?? "",
  };
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "undiscovered-art-seed-script/1.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function searchObjectIds({ query, isHighlight, medium }) {
  const searchUrl = new URL(SEARCH_ENDPOINT);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("hasImages", "true");
  if (isHighlight) searchUrl.searchParams.set("isHighlight", "true");
  if (medium) searchUrl.searchParams.set("medium", medium);

  const payload = await requestJson(searchUrl.toString());
  if (!Array.isArray(payload.objectIDs)) return [];
  return payload.objectIDs;
}

async function getObjectById(objectId, objectCache) {
  if (objectCache.has(objectId)) return objectCache.get(objectId);

  try {
    const object = await requestJson(`${OBJECT_ENDPOINT}/${objectId}`);
    objectCache.set(objectId, object);
    return object;
  } catch {
    objectCache.set(objectId, null);
    return null;
  }
}

async function fetchImageBuffer(imageUrl) {
  const response = await fetch(imageUrl, {
    headers: {
      "user-agent": "undiscovered-art-seed-script/1.0",
      accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Image request failed (${response.status}) for ${new URL(imageUrl).hostname}`,
    );
  }

  const extension = extensionForImageResponse(response, imageUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, extension };
}

async function ensureOutputDirectory() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function clearPreviousSeedFiles() {
  const entries = await fs.readdir(OUTPUT_DIR, { withFileTypes: true });
  const deleteOps = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    deleteOps.push(fs.unlink(path.join(OUTPUT_DIR, entry.name)));
  }

  await Promise.all(deleteOps);
}

async function buildCandidatePools(categories, globalQuery) {
  const pools = new Map();

  for (const category of categories) {
    const config = CATEGORY_CONFIG[category];
    const ids = new Set();

    for (const term of config.queryTerms) {
      const composedQuery = composeSearchQuery(globalQuery, term);

      for (const isHighlight of [true, false]) {
        try {
          const directIds = await searchObjectIds({
            query: composedQuery,
            isHighlight,
            medium: undefined,
          });
          for (const objectId of directIds) ids.add(objectId);
        } catch {
          // Continue with other search combinations.
        }
        await delay(REQUEST_DELAY_MS);

        for (const mediumTerm of config.mediumTerms) {
          try {
            const mediumIds = await searchObjectIds({
              query: composedQuery,
              isHighlight,
              medium: mediumTerm,
            });
            for (const objectId of mediumIds) ids.add(objectId);
          } catch {
            // Continue with other search combinations.
          }
          await delay(REQUEST_DELAY_MS);
        }
      }
    }

    const pool = [...ids];
    shuffleInPlace(pool);
    pools.set(category, pool);
    console.log(`[search] ${category}: ${pool.length} candidate objects`);
  }

  return pools;
}

async function tryCollectOneForCategory({
  category,
  state,
  manifest,
  usedObjectIds,
  objectCache,
  categoryCounts,
  sequenceWidth,
}) {
  while (state.cursor < state.ids.length && state.scanned < OBJECT_SCAN_LIMIT) {
    const objectId = state.ids[state.cursor];
    state.cursor += 1;

    if (usedObjectIds.has(objectId)) continue;

    const object = await getObjectById(objectId, objectCache);
    state.scanned += 1;
    if (!isUsableObjectForCategory(object, category)) {
      await delay(REQUEST_DELAY_MS);
      continue;
    }

    const imageUrl = object.primaryImage || object.primaryImageSmall;
    if (!imageUrl) {
      await delay(REQUEST_DELAY_MS);
      continue;
    }

    try {
      const { buffer, extension } = await fetchImageBuffer(imageUrl);
      const nextGlobalIndex = manifest.length;
      const nextCategoryIndex = categoryCounts.get(category) ?? 0;
      const sequence = String(nextGlobalIndex + 1).padStart(sequenceWidth, "0");
      const fileName = `${toKebab(category)}-${sequence}${extension}`;

      await fs.writeFile(path.join(OUTPUT_DIR, fileName), buffer);

      const item = createManifestItem({
        object,
        fileName,
        category,
        globalIndex: nextGlobalIndex,
        categoryIndex: nextCategoryIndex,
      });
      manifest.push(item);

      usedObjectIds.add(objectId);
      state.collected += 1;
      categoryCounts.set(category, nextCategoryIndex + 1);

      console.log(
        `[${manifest.length}] ${category} - ${item.title} (${Math.round(buffer.byteLength / 1024)} KB)`,
      );

      await delay(REQUEST_DELAY_MS);
      return true;
    } catch {
      await delay(REQUEST_DELAY_MS);
    }
  }

  return false;
}

async function main() {
  const targetCount = parsePositiveInteger(
    process.env.SEED_AUCTION_COUNT ?? process.env.SEED_PAINTING_COUNT,
    DEFAULT_COUNT,
  );
  const globalQuery = stripWhitespace(
    process.env.SEED_AUCTION_QUERY ?? process.env.SEED_PAINTING_QUERY ?? DEFAULT_QUERY,
  );
  const selectedCategories = parseCategories(process.env.SEED_AUCTION_CATEGORIES);
  const targetByCategory = distributeTargetAcrossCategories(
    selectedCategories,
    targetCount,
  );
  const sequenceWidth = Math.max(2, String(targetCount).length);

  await ensureOutputDirectory();
  await clearPreviousSeedFiles();

  console.log(
    `[fetch-public-domain-paintings] Preparing ${targetCount} assets across ${selectedCategories.join(", ")}`,
  );
  if (globalQuery) {
    console.log(`[fetch-public-domain-paintings] Global query: "${globalQuery}"`);
  }

  const candidatePools = await buildCandidatePools(selectedCategories, globalQuery);
  const totalCandidates = [...candidatePools.values()].reduce(
    (sum, ids) => sum + ids.length,
    0,
  );
  if (totalCandidates === 0) {
    throw new Error("No matching objects were returned by the search endpoint.");
  }

  const categoryStates = new Map();
  for (const category of selectedCategories) {
    categoryStates.set(category, {
      ids: candidatePools.get(category) ?? [],
      cursor: 0,
      scanned: 0,
      collected: 0,
    });
  }

  const manifest = [];
  const usedObjectIds = new Set();
  const objectCache = new Map();
  const categoryCounts = new Map(
    selectedCategories.map((category) => [category, 0]),
  );

  for (const category of selectedCategories) {
    const state = categoryStates.get(category);
    const wanted = targetByCategory.get(category) ?? 0;

    while (state.collected < wanted) {
      const added = await tryCollectOneForCategory({
        category,
        state,
        manifest,
        usedObjectIds,
        objectCache,
        categoryCounts,
        sequenceWidth,
      });
      if (!added) break;
    }
  }

  while (manifest.length < targetCount) {
    let madeProgress = false;

    for (const category of selectedCategories) {
      if (manifest.length >= targetCount) break;

      const state = categoryStates.get(category);
      const added = await tryCollectOneForCategory({
        category,
        state,
        manifest,
        usedObjectIds,
        objectCache,
        categoryCounts,
        sequenceWidth,
      });
      if (added) madeProgress = true;
    }

    if (!madeProgress) break;
  }

  if (manifest.length < targetCount) {
    const breakdown = selectedCategories
      .map((category) => {
        const got = categoryCounts.get(category) ?? 0;
        const wanted = targetByCategory.get(category) ?? 0;
        return `${category}:${got}/${wanted}`;
      })
      .join(", ");

    throw new Error(
      `Only collected ${manifest.length}/${targetCount} assets. Breakdown: ${breakdown}`,
    );
  }

  const manifestPath = path.join(OUTPUT_DIR, MANIFEST_FILE_NAME);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const finalBreakdown = selectedCategories
    .map((category) => `${category}:${categoryCounts.get(category) ?? 0}`)
    .join(", ");

  console.log(
    `[fetch-public-domain-paintings] Wrote ${manifest.length} records to ${manifestPath}`,
  );
  console.log(`[fetch-public-domain-paintings] Category breakdown: ${finalBreakdown}`);
  console.log(
    "[fetch-public-domain-paintings] Run `pnpm db:seed:auctions` to upload and create auctions.",
  );
}

main().catch((error) => {
  console.error("[fetch-public-domain-paintings] Failed:", error);
  process.exitCode = 1;
});
