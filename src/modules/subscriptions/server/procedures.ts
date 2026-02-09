import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { eq, and, getTableColumns, or, lt, desc } from "drizzle-orm";
import z from "zod";

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
                        subscriberCount: db.$count(subscriptions, eq(subscriptions.creatorId, users.id)),
                    },


                })
                .from(subscriptions)
                .innerJoin(users, eq(subscriptions.creatorId, users.id))
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
                //요청한 항목 수보다 항상 한 개 더 조회하여 다음 배치에 추가로 로드할 데이터가 있는지 확인할 수 있게 함
                .limit(limit + 1);

            const hasMore = data.length > limit;
            //Remove the last item if there is more data
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
                throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot subscribe to yourself" });
            }

            const [createdSubscription] = await db
                .insert(subscriptions)
                .values({
                    viewerId: ctx.user.id,
                    creatorId: userId,
                })
                .returning();
            return createdSubscription;
        }),

    remove: protectedProcedure
        .input(z.object({ userId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
            const { userId } = input;


            if (userId === ctx.user.id) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot subscribe to yourself" });
            }

            const [deletedSubscription] = await db
                .delete(subscriptions)
                .where(
                    and(
                        eq(subscriptions.viewerId, ctx.user.id),
                        eq(subscriptions.creatorId, userId),
                    )
                )
                .returning();
            return deletedSubscription;
        }),


});