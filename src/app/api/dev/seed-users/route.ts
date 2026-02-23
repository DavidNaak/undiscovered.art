import { NextResponse } from "next/server";

import { env } from "~/env";
import { auth } from "~/server/better-auth";

export const runtime = "nodejs";

const DEMO_USER_COUNT = 5;
const DEMO_PASSWORD = "Password123!";

export async function POST(request: Request) {
  if (env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const timestamp = Date.now();
  const created: Array<{ name: string; email: string; password: string }> = [];

  for (let i = 1; i <= DEMO_USER_COUNT; i += 1) {
    const name = `Demo Bidder ${i}`;
    const email = `demo.bidder.${timestamp}.${i}@example.com`;

    try {
      await auth.api.signUpEmail({
        headers: request.headers,
        body: {
          name,
          email,
          password: DEMO_PASSWORD,
        },
      });

      created.push({
        name,
        email,
        password: DEMO_PASSWORD,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : `Could not create demo user ${email}`,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    created,
  });
}
