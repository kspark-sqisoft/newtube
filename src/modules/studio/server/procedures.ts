import { z } from "zod";
import { db } from "@/db";
import {
  commentCountExpr,
  likeCountExpr,
  videoCommentStats,
  videoReactionStats,
  videoViewStats,
  viewCountExpr,
} from "@/db/aggregates";
import { users, videos } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { and, desc, eq, getTableColumns, lt, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const studioRouter = createTRPCRouter({

  getOne: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const { id } = input;
    const { id: userId } = ctx.user;

    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.userId, userId)))
      .limit(1);
    if (!video) throw new TRPCError({ code: "NOT_FOUND" });

    return video;
  }),


  getMany: protectedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.string().uuid(),
            updatedAt: z.date(),
          })
          .nullish(),
        limit: z.number().min(1).max(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const { id: userId } = ctx.user;

      const data = await db
        .select({
          ...getTableColumns(videos),
          viewCount: viewCountExpr,
          commentCount: commentCountExpr,
          likeCount: likeCountExpr,
          user: users,
        })
        .from(videos)
        .innerJoin(users, eq(videos.userId, users.id))
        .leftJoin(videoViewStats, eq(videoViewStats.videoId, videos.id))
        .leftJoin(videoReactionStats, eq(videoReactionStats.videoId, videos.id))
        .leftJoin(videoCommentStats, eq(videoCommentStats.videoId, videos.id))
        .where(
          and(
            eq(videos.userId, userId),
            cursor
              ? or(
                  lt(videos.updatedAt, cursor.updatedAt),
                  and(
                    eq(videos.updatedAt, cursor.updatedAt),
                    lt(videos.id, cursor.id)
                  )
                )
              : undefined
          )
        )
        .orderBy(desc(videos.updatedAt), desc(videos.id))
        //요청한 항목 수보다 항상 한 개 더 조회하여 다음 배치에 추가로 로드할 데이터가 있는지 확인할 수 있게 함
        .limit(limit + 1);

      const hasMore = data.length > limit;
      //Remove the last item if there is more data
      const items = hasMore ? data.slice(0, -1) : data;
      const lastItem = items[items.length - 1];
      const nextCursor = hasMore
        ? {
            id: lastItem.id,
            updatedAt: lastItem.updatedAt,
          }
        : null;

      return {
        items,
        nextCursor,
      };
    }),
});
