import { NextResponse } from "next/server";

import {
  MAX_UPLOAD_FILE_BYTES,
  isAllowedImageMimeType,
} from "~/lib/auctions/schema";
import { auth } from "~/server/better-auth";
import {
  getPublicImageUrl,
  getStorageBucket,
  getSupabaseAdminClient,
} from "~/server/storage/supabase";

export const runtime = "nodejs";

function getExtension(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || extension.length > 8) return "jpg";
  return extension;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const maybeFile = formData.get("file");
  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!isAllowedImageMimeType(maybeFile.type)) {
    return NextResponse.json(
      { error: "Only jpeg, png, webp, and gif files are supported" },
      { status: 400 },
    );
  }

  if (maybeFile.size > MAX_UPLOAD_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `File is too large. Max size is ${Math.floor(
          MAX_UPLOAD_FILE_BYTES / (1024 * 1024),
        )}MB`,
      },
      { status: 400 },
    );
  }

  try {
    const bucket = getStorageBucket();
    const supabase = getSupabaseAdminClient();
    const extension = getExtension(maybeFile.name);
    const imagePath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;

    const buffer = Buffer.from(await maybeFile.arrayBuffer());
    const { error } = await supabase.storage.from(bucket).upload(imagePath, buffer, {
      contentType: maybeFile.type,
      upsert: false,
      cacheControl: "3600",
    });

    if (error) {
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      imagePath,
      imageUrl: getPublicImageUrl(imagePath),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Storage is not configured for uploads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
