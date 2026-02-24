import { z } from "zod";

import { AUCTION_CATEGORY_VALUES } from "./categories";

export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
export const MIN_BID_CENTS = 100;
export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2_000;

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const moneyStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Use a valid amount (e.g. 120 or 120.50)");

export const auctionCategorySchema = z.enum(AUCTION_CATEGORY_VALUES);
export type AuctionCategory = z.infer<typeof auctionCategorySchema>;

export const auctionSortBySchema = z.enum([
  "ending-soon",
  "newest",
  "price-low",
  "price-high",
  "most-bids",
]);
export type AuctionSortBy = z.infer<typeof auctionSortBySchema>;

export const createAuctionFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or less`),
  description: z
    .string()
    .trim()
    .max(
      MAX_DESCRIPTION_LENGTH,
      `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
    )
    .optional(),
  category: auctionCategorySchema,
  startPrice: moneyStringSchema,
  minIncrement: moneyStringSchema,
  endsAt: z.string().trim().min(1, "End time is required"),
});

export const createArtworkUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name is too long"),
  fileType: z
    .string()
    .trim()
    .refine(
      (value) => isAllowedImageMimeType(value),
      "Only jpeg, png, webp, and gif files are supported",
    ),
  fileSize: z
    .number()
    .int()
    .positive("File is required")
    .max(MAX_UPLOAD_FILE_BYTES, "Image is too large. Max size is 5MB"),
});

export const createAuctionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3)
      .max(MAX_TITLE_LENGTH),
    description: z
      .string()
      .trim()
      .max(MAX_DESCRIPTION_LENGTH)
      .optional(),
    category: auctionCategorySchema,
    imagePath: z.string().trim().min(1).max(512),
    startPriceCents: z.number().int().min(MIN_BID_CENTS),
    minIncrementCents: z.number().int().min(MIN_BID_CENTS),
    endsAt: z.date(),
  })
  .superRefine((input, ctx) => {
    if (input.endsAt <= new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be in the future",
        path: ["endsAt"],
      });
    }
  });

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;

export const placeBidSchema = z.object({
  auctionId: z.string().trim().cuid("Invalid auction id"),
  amountCents: z.number().int().min(MIN_BID_CENTS),
});

export type PlaceBidInput = z.infer<typeof placeBidSchema>;

export function dollarsToCents(rawValue: string): number {
  return Math.round(Number(rawValue) * 100);
}

export function datetimeLocalToDate(rawValue: string): Date | null {
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function isAllowedImageMimeType(mimeType: string): boolean {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}
