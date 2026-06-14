import { db } from "@/db";
import {
  subscriberCountExpr,
  subscriberStats,
  videoCountExpr,
  userVideoStats,
} from "@/db/aggregates";
import { subscriptions, users } from "@/db/schema";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { eq, getTableColumns, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";

export const usersRouter = createTRPCRouter({
  getOne: baseProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user?.id;

      const viewerSubscriptions = db.$with("viewer_subscriptions").as(
        db
          .select()
          .from(subscriptions)
          .where(inArray(subscriptions.viewerId, userId ? [userId] : [])),
      );

      const [existingUser] = await db
        .with(viewerSubscriptions)
        .select({
          ...getTableColumns(users),
          viewerSubscribed: isNotNull(viewerSubscriptions.viewerId).mapWith(
            Boolean,
          ),
          videoCount: videoCountExpr,
          subscriberCount: subscriberCountExpr,
        })
        .from(users)
        .leftJoin(userVideoStats, eq(userVideoStats.userId, users.id))
        .leftJoin(subscriberStats, eq(subscriberStats.creatorId, users.id))
        .leftJoin(
          viewerSubscriptions,
          eq(viewerSubscriptions.creatorId, users.id),
        )
        .where(eq(users.id, input.id));

      if (!existingUser) throw new TRPCError({ code: "NOT_FOUND" });

      return existingUser;
    }),
});
