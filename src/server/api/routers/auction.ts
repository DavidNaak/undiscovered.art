import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  auctionCategorySchema,
  auctionSortBySchema,
  createAuctionSchema,
  placeBidSchema,
} from "~/lib/auctions/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { placeBid } from "~/server/services/auction/bidding";
import { settleExpiredAuctions } from "~/server/services/auction/settlement";
import {
  getPublicImageUrl,
  getStorageBucket,
  getSupabaseAdminClient,
} from "~/server/storage/supabase";

const listOpenInputSchema = z
  .object({
    query: z.string().trim().max(80).optional(),
    category: auctionCategorySchema.optional(),
    sortBy: auctionSortBySchema.optional(),
  })
  .optional();

export const auctionRouter = createTRPCRouter({
  listOpen: publicProcedure.input(listOpenInputSchema).query(async ({ ctx, input }) => {
      const searchQuery = input?.query?.trim();
      const category = input?.category;
      const sortBy = input?.sortBy ?? "ending-soon";
      const now = new Date();
      await settleExpiredAuctions(ctx.db, now);

      const orderBy =
        sortBy === "newest"
          ? [{ createdAt: "desc" as const }]
          : sortBy === "price-low"
            ? [{ currentPriceCents: "asc" as const }, { createdAt: "desc" as const }]
            : sortBy === "price-high"
              ? [{ currentPriceCents: "desc" as const }, { createdAt: "desc" as const }]
              : sortBy === "most-bids"
                ? [{ bidCount: "desc" as const }, { createdAt: "desc" as const }]
                : [{ endsAt: "asc" as const }, { createdAt: "desc" as const }];

      const auctions = await ctx.db.auction.findMany({
        where: {
          status: "LIVE",
          endsAt: { gt: now },
          ...(category ? { category } : {}),
          ...(searchQuery
            ? {
                OR: [
                  { title: { contains: searchQuery, mode: "insensitive" } },
                  { description: { contains: searchQuery, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          dimensions: true,
          condition: true,
          artworkYear: true,
          imagePath: true,
          startPriceCents: true,
          currentPriceCents: true,
          minIncrementCents: true,
          endsAt: true,
          createdAt: true,
          bidCount: true,
          seller: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        take: 24,
      });

      return auctions.map((auction) => ({
        ...auction,
        imageUrl: getPublicImageUrl(auction.imagePath),
      }));
    }),

  create: protectedProcedure
    .input(createAuctionSchema)
    .mutation(async ({ ctx, input }) => {
      const imagePathPrefix = `${ctx.session.user.id}/`;
      if (!input.imagePath.startsWith(imagePathPrefix)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid artwork image path",
        });
      }

      try {
        const auction = await ctx.db.auction.create({
          data: {
            sellerId: ctx.session.user.id,
            title: input.title.trim(),
            description: input.description?.trim() ?? null,
            category: input.category,
            dimensions: input.dimensions,
            condition: input.condition,
            artworkYear: input.artworkYear,
            imagePath: input.imagePath,
            startPriceCents: input.startPriceCents,
            currentPriceCents: input.startPriceCents,
            minIncrementCents: input.minIncrementCents,
            endsAt: input.endsAt,
          },
          select: {
            id: true,
            title: true,
            endsAt: true,
            category: true,
            dimensions: true,
            condition: true,
            artworkYear: true,
            imagePath: true,
            startPriceCents: true,
            currentPriceCents: true,
          },
        });

        return {
          ...auction,
          imageUrl: getPublicImageUrl(auction.imagePath),
        };
      } catch (error) {
        try {
          const { error: cleanupError } = await getSupabaseAdminClient()
            .storage
            .from(getStorageBucket())
            .remove([input.imagePath]);

          if (cleanupError) {
            console.error(
              `[AUCTION_CREATE] Failed to clean up uploaded image ${input.imagePath}: ${cleanupError.message}`,
            );
          }
        } catch (cleanupError) {
          console.error(
            `[AUCTION_CREATE] Failed to run image cleanup for ${input.imagePath}`,
            cleanupError,
          );
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create auction. Please try again.",
          cause: error,
        });
      }
    }),

  placeBid: protectedProcedure
    .input(placeBidSchema)
    .mutation(async ({ ctx, input }) =>
      placeBid({
        db: ctx.db,
        input,
        userId: ctx.session.user.id,
      }),
    ),
});
