import { createClient } from "@supabase/supabase-js";

import { env } from "~/env";

export const DEFAULT_STORAGE_BUCKET = "auction-images";

export function getStorageBucket(): string {
  return env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_STORAGE_BUCKET;
}

export function getSupabaseAdminClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getPublicImageUrl(imagePath: string): string | null {
  if (!env.SUPABASE_URL) return null;

  const bucket = encodeURIComponent(getStorageBucket());
  const safePath = imagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${safePath}`;
}
