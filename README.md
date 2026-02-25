# undiscovered.art

## Auction Seed Scripts

This repo includes a full workflow for preparing and seeding auction assets.

### 1) Download public-domain artwork assets

Command:

```bash
pnpm db:prepare:artworks
```

Script:
- `scripts/fetch-public-domain-paintings.mjs`

What it does:
- Pulls public-domain images from The Met Open Access API
- Builds `public/images/seed-auctions/manifest.json`
- Downloads image files into `public/images/seed-auctions`
- Auto-tags each record with one of the app categories:
  - `PAINTING`
  - `SCULPTURE`
  - `PHOTOGRAPHY`
  - `DIGITAL_ART`
  - `MIXED_MEDIA`
  - `DRAWING`

Optional env vars:
- `SEED_AUCTION_COUNT` (default: `30`)
- `SEED_AUCTION_CATEGORIES` (comma-separated list)
- `SEED_AUCTION_QUERY` (extra global search bias, for example `modernism`)

Back-compat aliases (still supported):
- `SEED_PAINTING_COUNT`
- `SEED_PAINTING_QUERY`
- `pnpm db:prepare:paintings` (same script/behavior)

Examples:

```bash
SEED_AUCTION_COUNT=30 pnpm db:prepare:artworks
SEED_AUCTION_COUNT=36 SEED_AUCTION_CATEGORIES=PAINTING,SCULPTURE,PHOTOGRAPHY,DRAWING pnpm db:prepare:artworks
SEED_AUCTION_QUERY=impressionism pnpm db:prepare:artworks
```

### 2) Seed auctions into DB + upload images to Supabase

Command:

```bash
pnpm db:seed:auctions
```

Script:
- `scripts/seed-demo-auctions.mjs`

What it does:
- Reads `public/images/seed-auctions/manifest.json`
- Uploads each local file in `public/images/seed-auctions` to Supabase Storage
- Creates auction rows in the database

Required env vars:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional env vars:
- `SUPABASE_STORAGE_BUCKET` (default: `auction-images`)
- `DEMO_AUCTION_SEED_EMAILS` (comma-separated seller emails to target)

### 3) Reset auction data

Command:

```bash
pnpm db:reset:auctions
```

Script:
- `scripts/reset-auction-data.mjs`

What it does:
- Clears auction/bid data so you can reseed from a clean state

### 4) Run bid concurrency checks

Command:

```bash
pnpm test:concurrency
```

Script:
- `scripts/test-place-bid-concurrency.mjs`

What it does:
- Runs transaction-level bidding and settlement race-condition checks

## Typical End-to-End Flow

```bash
pnpm db:prepare:artworks
pnpm db:reset:auctions
pnpm db:seed:auctions
```
