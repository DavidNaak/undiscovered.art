import {
  MAX_UPLOAD_FILE_BYTES,
  isAllowedImageMimeType,
} from "~/lib/auctions/schema";
import { type AuctionCategoryValue } from "~/lib/auctions/categories";
import { type AuctionConditionValue } from "~/lib/auctions/conditions";

export type AuctionFormValues = {
  title: string;
  description: string;
  category: AuctionCategoryValue;
  dimensions: string;
  condition: AuctionConditionValue;
  artworkYear: string;
  startPrice: string;
  minIncrement: string;
  endsAt: string;
  imageFile: File | null;
};

export type SubmitPhase =
  | "idle"
  | "preparingUpload"
  | "uploadingImage"
  | "creatingAuction";

export const DEFAULT_AUCTION_FORM_VALUES: AuctionFormValues = {
  title: "",
  description: "",
  category: "PAINTING",
  dimensions: "",
  condition: "EXCELLENT",
  artworkYear: String(new Date().getFullYear()),
  startPrice: "100",
  minIncrement: "10",
  endsAt: "",
  imageFile: null,
};

export function toFieldError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Invalid value";
}

export function getSubmitLabel(phase: SubmitPhase): string {
  if (phase === "preparingUpload") return "Preparing upload...";
  if (phase === "uploadingImage") return "Uploading image...";
  if (phase === "creatingAuction") return "Creating auction...";
  return "Create Auction";
}

export function validateArtworkFile(value: File | null): string | undefined {
  if (!value) return "Artwork image is required";
  if (!isAllowedImageMimeType(value.type)) {
    return "Only jpeg, png, webp, and gif files are supported";
  }
  if (value.size > MAX_UPLOAD_FILE_BYTES) {
    return "Image is too large. Max size is 5MB";
  }
  return undefined;
}
