# undiscovered.art

Timed art auction house (eBay-style) built with Next.js, tRPC, Prisma/Postgres, Better Auth, and Supabase Storage.

## Quick Start

1. Install deps

```bash
pnpm install
```

2. Configure env (`.env`)

Required:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (or use default `auction-images`)
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (usually `http://localhost:3000`)
- GitHub OAuth values if using GitHub sign-in

3. Apply Prisma schema

```bash
pnpm db:push
```

4. Run app

```bash
pnpm dev
```

## Demo Data (Recommended)

Create users (from login page):
- Use **Create 5 Demo Users**.
- Demo users are initialized with **$50,000** balance.

Reset auctions/bids:

```bash
pnpm db:reset:auctions
```

Seed auctions + images + bids:

```bash
pnpm db:seed:auctions
```

What seed does:
- uploads local assets from `public/images/seed-auctions` to Supabase Storage
- creates 30 auctions across categories
- sets most auctions around ~2 days remaining, with periodic longer ones (~5/7/9 days)
- creates realistic bid ladders across different demo users
- maintains available/reserved balances while seeding bids
- auto-compresses oversized JPEGs to fit bucket upload limits

## Useful Scripts

- `pnpm dev` - run local app
- `pnpm lint` - lint
- `pnpm typecheck` - TypeScript check
- `pnpm db:push` - sync Prisma schema
- `pnpm db:reset:auctions` - delete auctions/bids + release reserved balances
- `pnpm db:seed:auctions` - seed auctions/images/bids
- `pnpm db:prepare:artworks` - regenerate seed manifest/images from Met Open Access
- `pnpm test:concurrency` - integration-style concurrency checks for bidding/settlement
- `pnpm test:settlement:cron` - integration-style cron settlement check

## Architecture Decisions and Tradeoffs

### Auction model
- **English auction** (ascending bids).
- Server validates each bid: auction live, minimum increment, seller cannot bid, sufficient funds.

### Concurrency model
- `placeBid` runs in **SERIALIZABLE** transaction + compare-and-set auction price update.
- Retries on serialization conflicts (`P2034`).
- Funds are held in `reservedBalanceCents` for current leaders; previous leader hold is released.

Why this approach:
- strong correctness for take-home scope
- lower operational complexity than queue/event-sourcing
- easier to reason about than custom lock orchestration

### Live updates
- Client polling for list/detail freshness (simple and reliable for scope).
- Confirmed-only bid UX (no optimistic “revert” confusion).

### Settlement approach (old vs current)
- Earlier approach settled during user-facing reads, which increased latency.
- Current approach uses dedicated settlement service + cron endpoint:
  - `GET /api/cron/settle-auctions`
  - configured in `vercel.json` for every minute in deployment.

## Localhost vs Vercel Settlement

Important behavior:
- On **Vercel**: scheduler hits `/api/cron/settle-auctions` every minute.
- On **localhost**: no automatic scheduler runs by default.

So locally, settlement happens when you:
1. call cron endpoint manually, or
2. attempt to place a bid on an expired auction (bid flow settles then rejects as closed).

Therefore, “only bidding on expired auctions settles locally” is **not fully correct**; manual cron endpoint calls also settle locally.

## Testing Notes

- Concurrency and settlement test scripts exist and are runnable.
- Cron settlement integration script is included (`pnpm test:settlement:cron`) to verify the cron path end-to-end against a running local server.
- Due take-home time limits, this is script-based validation, not full CI coverage.

## Known Limitations / Next Steps

- Cron is external in production and manual in local unless separately scheduled.
- Real-time UX is polling-based (WebSocket/Realtimes could be added later).
- Storage upload currently favors pragmatic server flow; direct signed client upload can be added for higher scale.
- More production hardening possible around observability, rate limits, and anti-sniping rules.
