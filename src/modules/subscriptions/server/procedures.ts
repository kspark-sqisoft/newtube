import { db } from "@/db";
import { subscriberCountExpr, subscriberStats } from "@/db/aggregates";
import { subscriptions, users } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { eq, and, getTableColumns, or, lt, desc } from "drizzle-orm";
import { z } from "zod";

export const subscriptionsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            creatorId: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      const data = await db
        .select({
          ...getTableColumns(subscriptions),
          user: {
            ...getTableColumns(users),
            subscriberCount: subscriberCountExpr,
          },
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.creatorId, users.id))
        .leftJoin(subscriberStats, eq(subscriberStats.creatorId, users.id))
        .where(
          and(
            eq(subscriptions.viewerId, userId),
            cursor
              ? or(
                  lt(subscriptions.updatedAt, cursor.updatedAt),
                  and(
                    eq(subscriptions.updatedAt, cursor.updatedAt),
                    lt(subscriptions.creatorId, cursor.creatorId),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.creatorId))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            creatorId: lastItem.creatorId,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),

  create: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot subscribe to yourself",
        });
      }

      // 같은 (viewer, creator) 재호출 시 PK 충돌이 5xx 로 새지 않도록 idempotent 처리.
      const [createdSubscription] = await db
        .insert(subscriptions)
        .values({
          viewerId: ctx.user.id,
          creatorId: userId,
        })
        .onConflictDoNothing({
          target: [subscriptions.viewerId, subscriptions.creatorId],
        })
        .returning();

      if (createdSubscription) return createdSubscription;

      // 이미 구독한 상태였다면 기존 row 반환
      const [existing] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.viewerId, ctx.user.id),
            eq(subscriptions.creatorId, userId),
          ),
        );
      return existing;
    }),

  remove: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = input;

      if (userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot subscribe to yourself",
        });
      }

      const [deletedSubscription] = await db
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.viewerId, ctx.user.id),
            eq(subscriptions.creatorId, userId),
          ),
        )
        .returning();
      return deletedSubscription;
    }),
});
