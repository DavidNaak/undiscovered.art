import { createAuctionSchema } from "~/lib/auctions/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { getPublicImageUrl } from "~/server/storage/supabase";

export const auctionRouter = createTRPCRouter({
  listOpen: publicProcedure.query(async ({ ctx }) => {
    const auctions = await ctx.db.auction.findMany({
      where: {
        status: "LIVE",
        endsAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        imagePath: true,
        startPriceCents: true,
        currentPriceCents: true,
        minIncrementCents: true,
        endsAt: true,
        createdAt: true,
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
      const auction = await ctx.db.auction.create({
        data: {
          sellerId: ctx.session.user.id,
          title: input.title.trim(),
          description: input.description?.trim() ?? null,
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
          imagePath: true,
          startPriceCents: true,
          currentPriceCents: true,
        },
      });

      return {
        ...auction,
        imageUrl: getPublicImageUrl(auction.imagePath),
      };
    }),
});
