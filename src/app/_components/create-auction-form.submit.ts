import {
  type AuctionCategoryValue,
} from "~/lib/auctions/categories";
import {
  createArtworkUploadSchema,
  createAuctionFormSchema,
  datetimeLocalToDate,
  dollarsToCents,
} from "~/lib/auctions/schema";

import {
  type AuctionFormValues,
  type SubmitPhase,
  validateArtworkFile,
} from "./create-auction-form.types";

type UploadInitResponse = {
  imagePath?: string;
  signedUrl?: string;
  error?: string;
};

type CreateAuctionMutationInput = {
  title: string;
  description?: string;
  category: AuctionCategoryValue;
  imagePath: string;
  startPriceCents: number;
  minIncrementCents: number;
  endsAt: Date;
};

type CreateAuctionMutation = (
  input: CreateAuctionMutationInput,
) => Promise<unknown>;

class CreateAuctionSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateAuctionSubmissionError";
  }
}

function parseUploadInitResponse(json: unknown): UploadInitResponse {
  if (!json || typeof json !== "object") {
    return {};
  }

  const objectJson = json as Record<string, unknown>;
  return {
    imagePath:
      typeof objectJson.imagePath === "string" ? objectJson.imagePath : undefined,
    signedUrl:
      typeof objectJson.signedUrl === "string" ? objectJson.signedUrl : undefined,
    error: typeof objectJson.error === "string" ? objectJson.error : undefined,
  };
}

async function requestSignedUpload(imageFile: File): Promise<{
  imagePath: string;
  signedUrl: string;
}> {
  const parsedUploadRequest = createArtworkUploadSchema.safeParse({
    fileName: imageFile.name,
    fileType: imageFile.type,
    fileSize: imageFile.size,
  });

  if (!parsedUploadRequest.success) {
    throw new CreateAuctionSubmissionError(
      parsedUploadRequest.error.issues[0]?.message ?? "Invalid image",
    );
  }

  const uploadInitResponse = await fetch("/api/uploads/artwork", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedUploadRequest.data),
  });
  const uploadInitJson = parseUploadInitResponse(
    await uploadInitResponse.json().catch(() => null),
  );

  if (!uploadInitResponse.ok || !uploadInitJson.imagePath || !uploadInitJson.signedUrl) {
    throw new CreateAuctionSubmissionError(
      uploadInitJson.error ?? "Could not prepare image upload",
    );
  }

  return {
    imagePath: uploadInitJson.imagePath,
    signedUrl: uploadInitJson.signedUrl,
  };
}

async function uploadArtworkFile(signedUrl: string, imageFile: File): Promise<void> {
  const uploadResponse = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "cache-control": "max-age=3600",
      "content-type": imageFile.type,
      "x-upsert": "false",
    },
    body: imageFile,
  });

  if (!uploadResponse.ok) {
    throw new CreateAuctionSubmissionError("Image upload failed. Please try again.");
  }
}

export async function submitCreateAuction({
  value,
  setSubmitPhase,
  createAuction,
}: {
  value: AuctionFormValues;
  setSubmitPhase: (phase: SubmitPhase) => void;
  createAuction: CreateAuctionMutation;
}): Promise<void> {
  const parsedForm = createAuctionFormSchema.safeParse({
    title: value.title,
    description: value.description,
    category: value.category,
    startPrice: value.startPrice,
    minIncrement: value.minIncrement,
    endsAt: value.endsAt,
  });

  if (!parsedForm.success) {
    throw new CreateAuctionSubmissionError(
      parsedForm.error.issues[0]?.message ?? "Fix form errors",
    );
  }

  const imageFile = value.imageFile;
  const imageValidationError = validateArtworkFile(imageFile);
  if (imageValidationError || !imageFile) {
    throw new CreateAuctionSubmissionError(
      imageValidationError ?? "Artwork image is required",
    );
  }

  const endsAtDate = datetimeLocalToDate(parsedForm.data.endsAt);
  if (!endsAtDate) {
    throw new CreateAuctionSubmissionError("Invalid end time");
  }

  setSubmitPhase("preparingUpload");
  const { imagePath, signedUrl } = await requestSignedUpload(imageFile);

  setSubmitPhase("uploadingImage");
  await uploadArtworkFile(signedUrl, imageFile);

  setSubmitPhase("creatingAuction");
  await createAuction({
    title: parsedForm.data.title,
    description: parsedForm.data.description?.trim() ?? undefined,
    category: parsedForm.data.category,
    imagePath,
    startPriceCents: dollarsToCents(parsedForm.data.startPrice),
    minIncrementCents: dollarsToCents(parsedForm.data.minIncrement),
    endsAt: endsAtDate,
  });
}
