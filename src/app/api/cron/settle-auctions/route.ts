import { NextResponse } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { settleExpiredAuctions } from "~/server/services/auction/settlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ", 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function isAuthorized(request: Request): boolean {
  if (!env.CRON_SECRET) {
    return env.NODE_ENV !== "production";
  }

  const token = parseBearerToken(request.headers.get("authorization"));
  return token === env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result = await settleExpiredAuctions(db, now);

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    attemptedCount: result.attemptedCount,
    failureCount: result.failureCount,
  });
}

