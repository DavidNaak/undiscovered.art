import { NextResponse } from "next/server";

import {
  createArtworkUploadSchema,
} from "~/lib/auctions/schema";
import { auth } from "~/server/better-auth";
import {
  getPublicImageUrl,
  getStorageBucket,
  getSupabaseAdminClient,
} from "~/server/storage/supabase";

export const runtime = "nodejs";

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function getExtension(fileName: string, mimeType: string): string {
  const extension = fileName
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (extension && extension.length <= 8) return extension;
  const fallbackExtension = MIME_TYPE_TO_EXTENSION[mimeType];
  if (fallbackExtension) return fallbackExtension;
  return "jpg";
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsedPayload = createArtworkUploadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        error: parsedPayload.error.issues[0]?.message ?? "Invalid upload request",
      },
      { status: 400 },
    );
  }

  try {
    const bucket = getStorageBucket();
    const supabase = getSupabaseAdminClient();
    const extension = getExtension(
      parsedPayload.data.fileName,
      parsedPayload.data.fileType,
    );
    const imagePath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(imagePath, { upsert: false });

    if (error) {
      return NextResponse.json(
        { error: `Could not prepare upload: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      imagePath: data.path,
      signedUrl: data.signedUrl,
      imageUrl: getPublicImageUrl(data.path),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Storage is not configured for uploads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
