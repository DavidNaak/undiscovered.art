import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  walletSummary: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        availableBalanceCents: true,
        reservedBalanceCents: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      availableCents: user.availableBalanceCents,
      inBidsCents: user.reservedBalanceCents,
    };
  }),
});
